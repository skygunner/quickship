import time
from datetime import datetime
from openerp.report import report_sxw

class pack_list(report_sxw.rml_parse):
    def __init__(self, cr, uid, name, context):
        super(pack_list, self).__init__(cr, uid, name, context=context)
        self.count = 0
        
        def get_qty(line):
            stock_obj = self.pool.get('stock.picking.out')
            stock_move_obj = self.pool.get('stock.move')
            product_id = line.product_id.id
            origin = line.picking_id.origin
            delivery_id = stock_obj.search(cr, uid, [('origin', '=', origin)], context=context)[0]
            sale_obj = self.pool.get('stock.picking').browse(cr, uid, delivery_id, context=context)
            sale_browse = self.pool.get('sale.order').browse(cr, uid, [sale_obj.sale_id.id], context=context)[0]
            
            for line in sale_obj.move_lines:
                stock_move_ids = stock_move_obj.browse(cr, uid, [line.id], context=context)[0]
                for sale_line in sale_browse.order_line:
                    if sale_line.product_id.id == product_id:
                        return int(sale_line.product_uom_qty)
                    
        def get_ref(origin):
            delivery_id = self.pool.get('stock.picking.out').search(cr, uid, [('origin', '=', origin)], context=context)[0]
            sale_obj = self.pool.get('stock.picking').browse(cr, uid, delivery_id, context=context)
            sale_browse = self.pool.get('sale.order').browse(cr, uid, [sale_obj.sale_id.id], context=context)[0]
            return sale_browse.user_id.name
            
        def get_backorder_qty(line):
            stock_obj = self.pool.get('stock.picking.out')
            product_id = line.product_id.id
            current_pick_id = line.picking_id.id
            pick_id = stock_obj.search(cr, uid, [('backorder_id', '=', current_pick_id)], context=context)
            if not pick_id:
                return 0
            else:
                stock_picking_browse = stock_obj.browse(cr, uid, pick_id, context=context)[0]
                for stock_pick in stock_picking_browse.move_lines:
                    if product_id == stock_pick.product_id.id:
                        return int(stock_pick.product_qty)

        self.localcontext.update({
            'time': time,
            'get_product_desc': self.get_product_desc,
            'get_qty': get_qty,
            'get_product_qty': self.get_product_qty,
            'get_sequence': self.get_sequence,
            'get_date': self.get_date,
            'get_ref': get_ref,
            'get_ref1': self.get_ref1,
            'get_ref2': self.get_ref2,
            'get_alias': self.get_alias,
            'get_backorder_qty': get_backorder_qty, 
            'get_packer_id': self.get_packer_id,
        })

    def get_ref1(self, obj):
        try:
            ref1 = obj.packages_ids[0].ref1
        except:
            ref1 = None

        if not ref1:
            ref1 = 'SO'

        return ref1


    def get_ref2(self, obj):
        try:
            ref2 = obj.packages_ids[0].ref2
        except:
            ref2 = None

        if not ref2:
            ref2 = obj.origin

        return ref2

    def get_alias(self, partner, product):
        codes = [field for field in product.partner_related_ids if (
            field.partner_id == partner and field.product_id == product and field.name == "default_code"
        )]

        if codes:
            return codes[0].value

        return ''

    def get_date(self, date):
        try:
            date = datetime.strptime(date, '%Y-%m-%d %H:%M:%S')
        except:
            date = datetime.now()
        return date.strftime("%x")

    def get_packer_id(self, obj):
        last_package = obj.packages_ids[-1]
        if last_package.packer_id:
            packer = last_package.packer_id.name
        return packer
 
        
    def get_sequence(self):
        self.count = self.count + 1
        return self.count
        
    def get_product_desc(self, move_line):
        desc = move_line.product_id.name
        if move_line.product_id.default_code:
            desc = '[' + move_line.product_id.default_code + ']' + ' ' + desc
        return desc
        
    def get_product_qty(self, qty):
        return int(qty)
        
report_sxw.report_sxw('report.stock.picking.list.out', 'stock.picking.out', 'packing_list_report/report/packing_list_report.rml', parser=pack_list, header=False)