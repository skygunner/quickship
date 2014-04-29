from openerp.osv import fields,osv

class res_users(osv.osv):
    _inherit = "res.users"
    _columns = {
        "packages_picked": fields.one2many('stock.packages', 'picker_id', 'Packages Picked'),
        "packages_packed": fields.one2many('stock.packages', 'packer_id', 'Packages Packed'),
        "packages_shipped": fields.one2many('stock.packages', 'shipper_id', 'Packages Shipped')
    }

res_users()