#  -*- coding: utf-8 -*-
# 
# 
#     OpenERP, Open Source Management Solution
#     Copyright (C) 2014 RyePDX LLC (<http://www.ryepdx.com>)
#     Copyright (C) 2004-2010 OpenERP SA (<http://www.openerp.com>)
# 
#     This program is free software: you can redistribute it and/or modify
#     it under the terms of the GNU General Public License as published by
#     the Free Software Foundation, either version 3 of the License, or
#     (at your option) any later version.
# 
#     This program is distributed in the hope that it will be useful,
#     but WITHOUT ANY WARRANTY; without even the implied warranty of
#     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#     GNU General Public License for more details.
# 
#     You should have received a copy of the GNU General Public License
#     along with this program.  If not, see <http://www.gnu.org/licenses/>
##############################################################################

import base64
from openerp.osv import osv, fields
from openerp.tools.translate import _
from decimal import Decimal
from ..shipping_api_price_comparison.helpers import rates
from ..shipping_api_usps.api import v1 as usps_api

class stock_packages(osv.osv):

    _inherit = 'stock.packages'
    _log_access = True
    _columns = {
        'shipping_company': fields.many2one("logistic.company", "Shipping Company"),
        'picker_id': fields.many2one("res.users", "Picker", required=True),
        'packer_id': fields.many2one("res.users", "Packer", required=True),
        'shipper_id': fields.many2one("res.users", "Shipper", required=True),
        'created': fields.datetime('created')
    #    'shipping_service':,
    }
    _defaults = {
        'created': fields.datetime.now
    }
    
    def get_label(self, cr, uid, package_id, shipping=None, test=None, context=None):
        '''Returns a base64-encoded EPL2 label'''

        # Return immediately if we're just checking endpoints.
        if test:
            return {'label': base64.b64encode("dummy label data")}

        package = self.pool.get("stock.packages").browse(cr, uid, package_id)

        if shipping["company"] == "USPS":
            usps_config = usps_api.get_config(cr, uid, sale=package.pick_id.sale_id, context=context)
            label = usps_api.get_label(
                usps_config, package.pick_id, package, service=shipping["service"].replace(" ", "")
            )

        elif shipping["company"] == "UPS":
            label = {}

        else:
            return {"error": "Shipping company '%s' not recognized." % shipping['company']}

        return {
            'label': base64.b64encode(label.label),
            'postage_balance': label.postage_balance
        }

    def get_quotes(self, cr, uid, package_id, test=None, context=None):
        '''Returns a list of all shipping options'''

        # Return immediately if we're just checking endpoints.
        if test:
            return {
                'quotes': [{
                    "company": "USPS",
                    "service": "Dummy Service",
                    "price": 1.0
                }]
            }

        pkg = self.pool.get("stock.packages").browse(cr, uid, package_id)
        usps_config = usps_api.get_config(cr, uid, sale=pkg.pick_id.sale_id, context=context)

        return {
            'quotes': sorted([
                quote for quote in rates.usps_quotes(
                    pkg.pick_id.sale_id, [pkg], config=usps_config, test_mode=test).get(pkg.id, [])
            ], key=lambda x: x["price"]) #+ [
#                quote for quote in rates.ups_quotes(sale_obj, weight_lbs, test_mode=test)
#            ]
        }

    def get_stats(self, cr, uid, fromDate, toDate, test=False):
        """Return a dictionary of pickers and packers."""
        package_pool = self.pool.get('stock.packages')
        user_pool = self.pool.get('res.users')
        quickshippers = user_pool.browse(cr, uid, user_pool.search(cr, uid, [('quickship_id','!=','')]))

        dateParams = []

        if fromDate:
            dateParams.append(('created', '>=', fromDate))

        if toDate:
            dateParams.append(('created', '<=', toDate))

        return {
            "pickers": sorted([
                {
                    'id': user.id,
                    'name': user.name,
                    'package_count': package_pool.search(
                        cr, uid, [('id','in',[pkg.id for pkg in user.packages_picked])] + dateParams, count=True
                    )
                } for user in quickshippers
            ], key=lambda u: u['package_count'], reverse=True),
            "packers": sorted([
                {
                    'id': user.id,
                    'name': user.name,
                    'package_count': package_pool.search(
                        cr, uid, [('id','in',[pkg.id for pkg in user.packages_packed])] + dateParams, count=True
                    )
                } for user in quickshippers
            ], key=lambda u: u['package_count'], reverse=True),
            "shippers": sorted([
                {
                    'id': user.id,
                    'name': user.name,
                    'package_count': package_pool.search(
                        cr, uid, [('id','in',[pkg.id for pkg in user.packages_shipped])] + dateParams, count=True
                    )
                } for user in quickshippers
            ], key=lambda u: u['package_count'], reverse=True)
        }

    def create_package(self, cr, uid, sale_order=None, package=None, test=False):
        '''Creates a package and adds it to the sale order's delivery order'''

        # Return immediately if we're just checking endpoints.
        if test:
            return {"id": 1, "success": True}

        sale_order_pool = self.pool.get("sale.order")
        sale_order_id = sale_order_pool.search(cr, uid, [('name','=',sale_order)], limit=1)

        # Return an error if we couldn't find a sale order by the given name,
        if not sale_order_id:
            return {"success": False, "error": _("Could not find sale order \"") + sale_order + "\""}

        if isinstance(sale_order_id, (list, tuple)):
            sale_order_id = sale_order_id[0]

        sale_order_obj = sale_order_pool.browse(cr, uid, sale_order_id)

        if not sale_order_obj.picking_ids:
            sale_order_pool.action_ship_create(cr, uid, [sale_order_id])
            sale_order_obj = sale_order_pool.browse(cr, uid, sale_order_id) # Reload sale_order from DB.

        picking_id = sale_order_obj.picking_ids[0]

        # We store weight in pounds.
        # TODO: Make dynamic based on locale.
        if package['scale']['unit'] == "kilogram":
            package['scale']['weight'] = float(Decimal(package['scale']['weight']) * Decimal("2.2046"))
            package['scale']['unit'] = "pound"

        # Required attributes.
        properties = {'weight': package["scale"]["weight"], "pick_id": picking_id.id}

        # Set package number.
        properties["packge_no"] = sorted(picking_id.packages_ids, key=lambda pkg: pkg.packge_no, reverse=True)[0].packge_no
        properties["packge_no"] = int(properties["packge_no"])+1 if properties["packge_no"] else 1

        # Set length, width, and height, if supplied.
        for field in ["length", "height", "width"]:
            if package.get(field):
                properties[field] = package[field]

        # Set picker, packer, and shipper, if supplied.
        user_pool = self.pool.get("res.users")
        for field in ["picker_id", "packer_id", "shipper_id"]:
            if package.get(field):
                properties[field] = user_pool.search(cr, uid, [("quickship_id","=",package[field])], limit=1)

                if properties[field]:
                    properties[field] = properties[field][0]
                else:
                    return {
                        "success": False,
                        "error": "Invalid value for %s! (\"%s\")" % (field, package[field]),
                        "field": field
                    }

        package_id = self.pool.get("stock.packages").create(cr, uid, properties)

        return {"id": package_id, "success": True}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: