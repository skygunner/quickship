# -*- coding: utf-8 -*-
import time
import openerp.addons.web.http as http
from ...shipping_api_usps.api import v1 as usps_api


class UspsController(http.Controller):
    _cp_path = '/usps'

    @http.jsonrequest
    def account_status(self, req, uid):
        '''Get a reading from the attached USB scale.'''
        response = usps_api.get_account_status(usps_api.get_config(req.cr, req.uid))

        if response.Status == 0:
            return {'success': True, 'postage_balance': response.CertifiedIntermediary.PostageBalance}

        return {'success': False, 'error': response.ErrorMessage}


    def _weigh(self, scale, test_weight = None):
        # Are we running an integration test...
        if test_weight:
            scale.device.set_weight(test_weight)
            weighing = scale.weigh(endpoint=self.mock_endpoint)

        # ...or are we doing an actual weighing?
        if not test_weight:
            weighing = scale.weigh()

        return weighing