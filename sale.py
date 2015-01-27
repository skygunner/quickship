import hashlib
from openerp.osv import fields, osv
from openerp.tools.translate import _

class sale_order_line(osv.Model):
    _inherit = 'sale.order.line'
    _sql_constraints = [
        # Add a unique product constraint to allow accurate calculation of backorders on reports and emails.
        ('unique_product_on_order', 'unique(order_id, product_id)', 'Sale order contains duplicate products!')
    ]

sale_order_line()


class sale_order(osv.Model):
    _inherit = 'sale.order'
    _columns = {
        "picking_list_version": fields.integer('Picking List Version'),
        "picking_list_hash": fields.char("Picking List Hash", size=64),
        "shipped": fields.boolean("Shipped")
    }
    _defaults = {
        "picking_list_version": 1,
        "shipped": False
    }

    def get_by_quickship_code(self, cr, uid, code, context=None):
        if ":" in code:
            name, picking_list_version = code.rsplit(":", 1)
        else:
            name = code
            picking_list_version = None

        criteria = [('name', '=', name)]
        if picking_list_version:
            criteria.append(('picking_list_version', '=', picking_list_version))

        try:
            sale_objs = self.browse(cr, uid, self.search(cr, uid, criteria))
        except ValueError:
            return {'message': 'Picking list version must be an integer!'}
        if not sale_objs:
            return {'message': "Sale order not found!"}

        sale_obj = sale_objs[0]

        if sale_obj.state == "cancel" or sale_obj.cancel_date:
            return {'message': "This sale has been cancelled!"}

        if sale_obj.partner_id.shipping_hold:
            return {'message': "Customer account (%s) has a shipping hold on it!" % sale_obj.partner_id.name}

        if ((not sale_obj.invoiced and sale_obj.order_policy == 'prepaid')\
                or (sale_obj.order_policy == 'credit_card' and sale_obj.state != 'cc_auth'))\
                and (not sale_obj.amazon_order_id):
            return {'message': "This sale has not been paid for yet!"}

        if picking_list_version and picking_list_version != str(sale_obj.picking_list_version):
            return {'message': "This is not the latest version of the picking list!"}

        if picking_list_version and self.generate_picking_list_hash(sale_obj) != sale_obj.picking_list_hash:
            return {'message': "This sale has changed since the last time a picking list was generated!"}

        return {'id': sale_obj.id, 'name': sale_obj.name, 'invoiced': sale_obj.invoiced}

    def deliver(self, cr, uid, ids, context=None):
        """ Makes partial moves and pickings done.
        @param self: The object pointer.
        @param cr: A database cursor
        @param uid: ID of the user currently logged in
        @param fields: List of fields for which we want default values
        @param context: A standard dictionary
        @return: A dictionary which of fields with values.
        """
        partial_datas = {'delivery_date': fields.datetime.now()}

        sale_id = self.browse(cr, uid, ids[0])
        sale_pool = self.pool.get('sale.order')
        sale_pool.write(cr, uid, ids, {'state': 'done', 'shipped': True})

        for pick in sale_id.picking_ids:
            picking_type = pick.type if 'average' in [m.product_id.cost_method for m in pick.move_lines] else 'out'

            for move in pick.move_lines:
                partial_datas['move%s' % (move.id)] = {
                    'product_id': move.id,
                    'product_qty': move.product_qty,
                    'product_uom': move.product_uom.id,
                    'prodlot_id': move.prodlot_id.id,
                }
                if (picking_type == 'in') and (move.product_id.cost_method == 'average'):
                    product_currency_id = move.product_id.company_id.currency_id and move.product_id.company_id.currency_id.id
                    picking_currency_id = pick.company_id.currency_id and pick.company_id.currency_id.id
                    partial_datas['move%s' % (move.id)].update(
                        {'product_price' : move.product_id.standard_price,
                         'product_currency': product_currency_id or picking_currency_id or False,
                         })

        self.pool.get('stock.picking.out').write(cr, uid, [p.id for p in sale_id.picking_ids], {"ship_state": "shipped"})
        return self.pool.get('stock.picking').do_partial(
            cr, uid, [p.id for p in sale_id.picking_ids], partial_datas, context=context)


    def generate_picking_list_hash(self, sale_obj):
        hash_lines = []

        for picking_id in sale_obj.picking_ids:
            hash_lines.append(str(picking_id))

            for line in picking_id.move_lines:
                hash_lines.append("%s:%s:%s:%s:%s:%s" % (
                    line.priority, line.product_id.id, line.product_uos.id,
                    line.product_uos_qty, line.product_uom.id, line.note
                ))

        raw_data = hashlib.sha256()
        raw_data.update("\n".join(sorted(hash_lines)))
        return raw_data.hexdigest()

    def packing_list(self, cr, uid, ids, context=None):
        if not ids: return []
        return {
            'type': 'ir.actions.report.xml',
            'report_name': 'multiple.label.print',
            'datas': {
                'model': 'stock.picking',
                'id': ids and ids[0] or False,
                'ids': ids,
                'report_type': 'pdf'
                },
            'nodestroy': True
        }

    def get_customer_id(self, cr, uid, ids, context=None):
        res = self.get_by_quickship_code(cr, uid, ids, context=context)

        if 'id' not in res:
            return res

        sale_order = self.browse(cr, uid, res['id'], context=context)
        return {"id": sale_order.partner_shipping_id.id if sale_order.partner_shipping_id else sale_order.partner_id.id}

sale_order()


