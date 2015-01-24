# -*- coding: utf-8 -*-
import collections, time, urllib2
import openerp.addons.web.http as http
from ..shipping_api_usps.api import v1 as usps_api
from openerp.osv import fields,osv

MockResponse = collections.namedtuple("MockResponse", ["message"])

class res_users(osv.osv):
    _inherit = "res.users"
    _columns = {
        "packages_picked": fields.one2many('stock.packages', 'picker_id', 'Packages Picked'),
        "packages_packed": fields.one2many('stock.packages', 'packer_id', 'Packages Packed'),
        "packages_shipped": fields.one2many('stock.packages', 'shipper_id', 'Packages Shipped'),
        "quickship_id": fields.char('Quickship ID', size=2)
    }

    _sql_constraints = [('quickship_id', 'unique(quickship_id)', 'A user with that Quickship ID already exists.')]

    def account_status(self, cr, uid, test=None):
        '''Get the user's current account info..'''
        config = usps_api.get_config(cr, uid)

        if test == None:
            test = config.sandbox if hasattr(config, "sandbox") else config["sandbox"]

        try:
            response = usps_api.get_account_status(config, test=test)
        except urllib2.URLError:
            response = MockResponse("Could not connect to Endicia!")

        if hasattr(response, 'postage_balance'):
            return {'success': True, 'postage_balance': response.postage_balance}

        return {'success': False, 'error': response.message}

    def get_quickship_id(self, cr, uid, user_id=None):
        return self.pool.get("res.users").browse(cr, uid, user_id or uid).quickship_id

    def get_proxy_settings(self, cr, uid, context=None):
        return {
            'printer': self.get_printer_proxy_settings(cr, uid),
            'scale': self.get_scale_proxy_settings(cr, uid)
        }

res_users()