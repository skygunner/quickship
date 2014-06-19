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

import base64, urllib2
from collections import namedtuple
from decimal import Decimal
from openerp.osv import osv, fields
from openerp.tools.translate import _
from shipping_api_ups.api import v1 as ups_api
from shipping_api_usps.api import v1 as usps_api
from shipping_api_usps.api.v1 import Customs, CustomsItem
from quickship import image_to_epl2

AddressWrapper = namedtuple("AddressWrapper", ['name', 'street', 'street2', 'city', 'state', 'zip', 'country', 'phone'])
_PackageWrapper = namedtuple("PackageWrapper", ['weight_in_ozs', 'length', 'width', 'height', 'value'])

class PackageWrapper(_PackageWrapper):
    @property
    def weight(self):
        return round(float(self.weight_in_ozs) / 16, 1)

class sale_order(osv.osv):
    _inherit = 'sale.order'

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

class stock_packages(osv.osv):

    _inherit = 'stock.packages'
    _log_access = True

    def _weight_in_ozs(self, cr, uid, ids, field_name, arg, context):
        return dict([(pkg.id, round(float(pkg.weight)*16, 1)) for pkg in self.browse(cr, uid, ids)])

    _columns = {
        'shipping_company': fields.many2one("logistic.company", "Shipping Company"),
        'picker_id': fields.many2one("res.users", "Picker", required=True),
        'packer_id': fields.many2one("res.users", "Packer", required=True),
        'shipper_id': fields.many2one("res.users", "Shipper", required=True),
        'created': fields.datetime('created'),
        'value': fields.float(
            'Declared Value Override',
            help='The declared value of the package. Overrides the sum value of the package\'s contents.'),
        'weight_in_ozs': fields.function(_weight_in_ozs, method=True)
    }
    _defaults = {
        'created': fields.datetime.now
    }

    def get_label(self, cr, uid, package=None, package_id=None, from_address=None, to_address=None, shipping=None,
                  customs=None, test=None, context=None):
        '''Returns a base64-encoded EPL2 label'''

        # Return immediately if we're just checking endpoints.
        if test:
            return {'label': base64.b64encode("dummy label data")}

        if not package and not package_id:
            return {"error": "Cannot create label without a package!"}

        elif package:
            if package['scale']['unit'] == "kilogram":
                package['scale']['weight'] = float(
                    (Decimal(package['scale']['weight']) * Decimal("2.2046")).quantize(Decimal("1.00"))
                )
                package['scale']['unit'] = "pound"

            package = PackageWrapper(round(float(package["scale"]["weight"])*16, 1), package["length"],
                                 package["width"], package["height"], package.get("value"))
            picking = None

        elif package_id:
            package = self.pool.get("stock.packages").browse(cr, uid, package_id)
            picking = package.pick_id

        if from_address:
            from_address = AddressWrapper(
                from_address['name'], from_address['street'], from_address['street2'],
                from_address['city'], from_address['state'], from_address['zip'], from_address['country'],
                from_address.get("phone")
            )

        if to_address:
            to_address = AddressWrapper(
                to_address['name'], to_address['street'], to_address['street2'],
                to_address['city'], to_address['state'], to_address['zip'], to_address['country'],
                to_address.get("phone")
            )

         # Get the shipper and recipient addresses if all we have is the picking.
        if picking and not from_address:
            from_address = picking.company_id.partner_id
            from_address.state = from_address.state_id.code
            from_address.country = from_address.country_id.name

        if picking and not to_address:
            to_address = picking.sale_id.partner_shipping_id or ''
            to_address.state = to_address.state_id.code
            to_address.country = to_address.country_id.name

        # Grab customs info.
        customs_obj = None
        image_format = "EPL2"

        if to_address.country != from_address.country:
            if not customs:
                customs = {}

            company = self.pool.get("res.users").browse(cr, uid, uid).company_id

            if "items" not in customs:
                customs["items"] = [{
                    "description": company.customs_description,
                    "quantity": "1",
                    "weight": str(package.weight_in_ozs),
                    "value": str(package.value) or (str(package.decl_val) if hasattr(package, "decl_val") else None)
                }]

            customs_items = [CustomsItem(
                description=item.get("description") or company.customs_description,
                quantity=str(item.get("quantity") or "1"),
                weight=str(item.get("weight") or package.weight_in_ozs),
                value=str(item.get("value") or package.value) or (str(package.decl_val) if hasattr(package, "decl_val") else None)
            ) for item in customs["items"]]

            customs_obj = Customs(
                form_type=customs.get("form_type") or company.customs_form_type,
                signature=customs.get("signature") or company.customs_signature,
                contents_type=customs.get("contents_type") or company.customs_contents_type,
                contents_explanation=customs.get("explanation") or company.customs_explanation,
                restriction=customs.get("restriction") or company.customs_restriction,
                restriction_comments=customs.get("restriction_comments") or company.customs_restriction_comments,
                undeliverable=customs.get("undeliverable") or company.customs_undeliverable,
                eel_pfc=customs.get("eel_pfc") or company.customs_eel_pfc,
                senders_copy=customs.get("senders_copy") or company.customs_senders_copy,
                items=customs_items
            )
            image_format = "PNGMONOCHROME"

        # Grab config info
        if shipping["company"] == "USPS":
            if picking:
                usps_config = usps_api.get_config(cr, uid, sale=picking.sale_id, context=context)
            else:
                usps_config = usps_api.get_config(cr, uid, context=context)

            label = usps_api.get_label(usps_config, package, shipping["service"].replace(" ", ""),
                                       from_address=from_address, to_address=to_address, customs=customs_obj,
                                       test=test, image_format=image_format)

        elif shipping["company"] == "UPS":
            label = {}

        else:
            return {"error": "Shipping company '%s' not recognized." % shipping['company']}

        # If we got something besides EPL2 data, convert it to EPL2 format before sending it client-side.
        if image_format != "EPL2":
            label.label = image_to_epl2(label.label[0]) # Only interested in the first label right now.
        else:
            label.label = label.label[0]

        return {
            'label': base64.b64encode(label.label),
            'format': "EPL2",
            'postage_balance': label.postage_balance
        }

    def get_quotes(self, cr, uid, pkg, sale_id=None, from_address=None, to_address=None, test=None, context=None):
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

        # Convert kilograms to pounds?
        if pkg['scale']['unit'] == "kilogram":
            pkg['scale']['weight'] = float(Decimal(pkg['scale']['weight']) * Decimal("2.2046"))
            pkg['scale']['unit'] = "pound"

        # Wrap our package dictionary so we can pass it safely to the USPS API.
        pkg = PackageWrapper(
            round(Decimal(pkg["scale"]["weight"])*16, 1), pkg["length"], pkg["width"], pkg["height"], pkg.get("value")
        )

        # Now what were we passed for purposes of finding an address?
        if sale_id:
            sale = self.pool.get("sale.order").browse(cr, uid, sale_id)
            usps_config = usps_api.get_config(cr, uid, sale=sale, context=context)
            ups_config = ups_api.get_config(cr, uid, sale=sale, context=context)
        else:
            sale = None
            usps_config = usps_api.get_config(cr, uid, context=context)

        if from_address:
            from_address = AddressWrapper(
                from_address['name'], from_address['street'], from_address['street2'],
                from_address['city'], from_address['state'], from_address['zip'], from_address['country']
            )
            
        if to_address:
            to_address = AddressWrapper(
                to_address['name'], to_address['street'], to_address['street2'],
                to_address['city'], to_address['state'], to_address['zip'], to_address['country']
            )

        try:
            return {
                'quotes': sorted([
                    quote for quote in usps_api.get_quotes(
                        usps_config, pkg, sale=sale,from_address=from_address, to_address=to_address, test=test
                    )
                #] + [
                #    quote for quote in ups_api.get_quotes(
                #        ups_config, pkg, sale=sale,from_address=from_address, to_address=to_address, test=test
                #    )
                ], key=lambda x: x["price"])
            }
        except urllib2.URLError:
            return {
                "success": False,
                "error": "Could not connect to Endicia!"
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

    def create_package(self, cr, uid, package, sale_order_id, num_packages=1, test=False):
        '''Creates a package and adds it to the sale order's delivery order'''

        # Return immediately if we're just checking endpoints.
        if test:
            return {"id": 1, "success": True}

        sale_order_pool = self.pool.get("sale.order")
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
        packages = sorted(picking_id.packages_ids, key=lambda pkg: pkg.packge_no, reverse=True)
        properties["packge_no"] = int(packages[0].packge_no) + 1 if packages and packages[0].packge_no else 1

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

        # Set package value override if there are no items assigned to the package.
        if num_packages and sale_order_obj and "stock_move_ids" not in package:
            properties["value"] = float(
                (Decimal(str(sale_order_obj.amount_total)) / Decimal(str(num_packages))).quantize(Decimal("1.00"))
            )

        package_id = self.pool.get("stock.packages").create(cr, uid, properties)

        return {
            "id": package_id,
            "picking_id": picking_id.id,
            "pack_list": properties["packge_no"] == 1,
            "success": True
        }

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: