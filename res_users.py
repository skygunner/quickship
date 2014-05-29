from openerp.osv import fields,osv

class res_users(osv.osv):
    _inherit = "res.users"
    _columns = {
        "packages_picked": fields.one2many('stock.packages', 'picker_id', 'Packages Picked'),
        "packages_packed": fields.one2many('stock.packages', 'packer_id', 'Packages Packed'),
        "packages_shipped": fields.one2many('stock.packages', 'shipper_id', 'Packages Shipped'),
        "quickship_id": fields.char('Quickship ID', size=2)
    }

    _sql_constraints = [('quickship_id', 'unique(quickship_id)', 'A user with that Quickship ID already exists.')]

res_users()