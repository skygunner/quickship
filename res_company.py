# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2011 NovaPoint Group LLC (<http://www.novapointgroup.com>)
#    Copyright (C) 2004-2010 OpenERP SA (<http://www.openerp.com>)
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>
#
##############################################################################

from openerp.osv import fields, osv

class res_company(osv.osv):
    _inherit = "res.company"
    
    _columns = {
        'customs_signature': fields.char('Customs Signature', size=47), # 47 is the field length in the Endicia API
        'customs_contents_type': fields.selection((
            ("Documents", "Documents"),
            ("Gift", "Gift"),
            ("Merchandise", "Merchandise"),
            ("Other", "Other"),
            ("ReturnedGoods", "Returned Goods"),
            ("Sample", "Sample"),
            ("HumanitarianDonation", "Humanitarian Donation"),
            ("DangerousGoods", "Dangerous Goods")
        ), 'Customs Contents Type', required=True),
        'customs_explanation': fields.char('Customs Contents Type (if "Other")', size=25), # 25 is the field length in the Endicia API
        'customs_restriction': fields.selection(
            (
                ('None', 'None'),
                ('Quarantine', 'Quarantine'),
                ('SanitaryPhytosanitaryInspection', 'Sanitary/Phytosanitary Inspection'),
                ('Other', 'Other')
        ), 'Customs Restriction', required=True),
        'customs_restriction_comments': fields.char('Customs Restriction Comments'),
        'customs_description': fields.char('Customs Item Description', size=50), # 50 is the field length in the Endicia API
        'customs_undeliverable': fields.selection((
            ('Return', 'Return to sender'),
            ('Abandon', 'Treat as abandoned'),
        ), 'If package is undeliverable...', required=True),
        'customs_eel_pfc': fields.char('Customs EEL/PFC'),
        'customs_senders_copy': fields.boolean('Generate "Sender\'s Copy" of customs forms'),
        'customs_form_type': fields.selection(
            (("Form2976", "Form 2976"), ("Form2976A", "Form 2976A")), "Customs Form Type", required=True
        ),
        'customs_commodity_code': fields.char('Customs Commodity Code', size=15), # 15 is the field length in the UPS API
        'packing_list_text': fields.text("Packing List Text")
    }
    _defaults = {
        "customs_form_type": "Form2976A",
        "customs_contents_type": "Merchandise",
        "customs_restriction": "None",
        "customs_undeliverable": "Return",
        "customs_commodity_code": "P2522",
        "packing_list_text": "Thank you for your business!"
    }

res_company()

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: