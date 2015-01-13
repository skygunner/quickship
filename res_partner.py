from openerp.osv import osv, fields

class res_partner(osv.osv):
    _inherit = "res.partner"

    _columns = {
        'shipping_hold': fields.boolean('Shipping Hold', readonly=True),
        'shipping_hold_reason': fields.text('Reason for Shipping Hold', readonly=True),
        'shipping_hold_user_id': fields.many2one('res.users', 'Hold Placed By', readonly=True),
        'shipping_hold_date': fields.datetime('Hold Placed On', readonly=True)
    }

    _defaults = {
        'shipping_hold': False
    }

res_partner()