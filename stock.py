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
    _columns = {
        'shipping_company': fields.many2one("logistic.company", "Shipper"),
    #    'shipping_service':,
    }
    
    def get_label(self, cr, uid, package_id, shipping=None, test=None, context=None):
        '''Returns a base64-encoded EPL2 label'''

        # Return immediately if we're just checking endpoints.
        if test:
            return {'label': base64.b64encode("dummy label data")}

        package = self.pool.get("stock.packages").browse(cr, uid, package_id)

        if shipping["company"] == "USPS":
            usps_config = usps_api.get_config(cr, uid, sale=package.pick_id.sale_id, context=context)
            label = usps_api.get_label(usps_config, package.pick_id, package)

        elif shipping["company"] == "UPS":
            label = {}

        else:
            return {"error": "Shipping company '%s' not recognized." % shipping['company']}

        return {
            'label': base64.b64encode(label.label)
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
            'quotes': [
                quote for quote in rates.usps_quotes(
                    pkg.pick_id.sale_id, pkg, config=usps_config, test_mode=test)
            ] #+ [
#                quote for quote in rates.ups_quotes(sale_obj, weight_lbs, test_mode=test)
#            ]
        }

    def create_package(self, cr, uid, sale_order=None, package=None, test=False):
        '''Creates a package and adds it to the sale order's delivery order'''

        # Return immediately if we're just checking endpoints.
        if test:
            return {"id": 1, "success": True}

        sale_order_pool = self.pool.get("sale.order")
        sale_order_id = sale_order_pool.search(cr, uid, [('name','=',sale_order)], limit=1)

        if isinstance(sale_order_id, (list, tuple)):
            sale_order_id = sale_order_id[0]

        sale_order_obj = sale_order_pool.browse(cr, uid, sale_order_id)

        if not sale_order_obj:
            raise osv.except_osv(_("Sale Not Found"), _("Could not find sale order ") + sale_order)

        if not sale_order_obj.picking_ids:
            sale_order_pool.action_ship_create(self, cr, uid, sale_order_id, context=None)
            sale_order_obj = sale_order_pool.browse(cr, uid, sale_order_id) # Reload sale_order from DB.

        picking_id = sale_order_obj.picking_ids[0]

        # We store weight in pounds.
        # TODO: Make dynamic based on locale.
        if package['weight']['unit'] == "kilogram":
            package['weight']['value'] = float(Decimal(package['weight']['value']) * Decimal("2.2046"))
            package['weight']['unit'] = "pound"

        package_id = self.pool.get("stock.packages").create(
            cr, uid, {'weight': package["weight"]["value"], "pick_id": picking_id.id}
        )

        return {"id": package_id, "success": True}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: