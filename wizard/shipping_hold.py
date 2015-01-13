from openerp.osv import orm, fields

class shipping_hold(orm.TransientModel):
    _name = 'quickship.shipping_hold.wizard'
    _columns = {
        'shipping_hold_reason': fields.text('Reason for Placing Hold')
    }

    def place_hold(self, cr, uid, ids, context=None):
        if context.get("active_model") != 'res.partner' or not context.get('active_ids'):
            return True

        data = self.browse(cr, uid, ids[0], context=context)
        self.pool.get('res.partner').write(cr, uid, context.get('active_ids'), {
            'shipping_hold': True,
            'shipping_hold_reason': data.shipping_hold_reason,
            'shipping_hold_user_id': uid,
            'shipping_hold_date': fields.date.today()
        })

        return True

    def remove_hold(self, cr, uid, ids, context=None):
        if context.get("active_model") != 'res.partner' or not context.get('active_ids'):
            return True

        self.pool.get('res.partner').write(cr, uid, context.get('active_ids'), {
            'shipping_hold': False,
            'shipping_hold_reason': '',
            'shipping_hold_user_id': None,
            'shipping_hold_date': None
        })

shipping_hold()