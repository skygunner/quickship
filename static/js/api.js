Namespace("ryepdx.openerp.quickship").ApiFactory = function (instance, _options) {
    return new (instance.web.Class.extend({
        init: function(options){
            options = options || {};

            this.rpc = new instance.web.JsonRPC();
            this.rpc.setup(options.url || 'http://localhost:8069');
            this.packages = new instance.web.Model('stock.packages');
            this.picking = new instance.web.Model('stock.picking');
            this.users = new instance.web.Model('res.users');
            this.package_types = new instance.web.Model('shipping.package.type');
            this.sales = new instance.web.Model('sale.order');
            this.notifications = {};
        },

        // Makes a JSON-RPC call to the local OpenERP server.
        rpc : function(endpoint, name,params){
            var ret = new $.Deferred();
            var callbacks = this.notifications[name] || [];
            for(var i = 0; i < callbacks.length; i++){
                callbacks[i](params);
            }

            this.rpc.rpc('/' + endpoint + '/' + name, params || {}).done(function(result) {
                ret.resolve(result);
            }).fail(function(error) {
                ret.reject(error);
            });
            return ret;
        },

        ups_rpc: function (name, params) {
            return this.rpc('ups', name, params);
        },

        usps_rpc: function (name, params) {
            return this.rpc('usps', name, params);
        },

        report: function (name) {
            return this.rpc()
        },

        // Allows triggers to be set for when particular JSON-RPC function calls are made via 'message.'
        add_notification: function(name, callback){
            if(!this.notifications[name]){
                this.notifications[name] = [];
            }
            this.notifications[name].push(callback);
        },

        // Convenience function for creating a new package.
        create_package: function (pkg, sale_order, num_packages) {
            if (!num_packages) {
                num_packages = 1;
            }
            return this.packages.call("create_package", [pkg, sale_order], {"num_packages": num_packages});
        },

        check_inventory_availability: function (picking_id) {
            //return this.picking.call("action_assign", [[picking_id]]);
            return this.picking.call("force_assign", [[picking_id]]);
        },

        set_delivered: function (sale_id) {
            return this.sales.call("deliver", [[sale_id]]);
        },

        // Convenience function for getting quotes for a package.
        get_quotes: function (pkg, sale_id, from_address, to_address, test) {
            var kwargs = {};

            if (sale_id) {
                kwargs.sale_id = sale_id;
            }

            if (from_address) {
                kwargs.from_address = from_address;
            }

            if (to_address) {
                kwargs.to_address = to_address;
            }

            if (test !== undefined) {
                kwargs.test = test;
            }
            return this.packages.call('get_quotes', [pkg], kwargs);
        },

        // Convenience function for getting the label for a package.
        get_label_by_package_id: function (package_id, shipping, customs, test) {
            var params = {
                "shipping": shipping,
                "package_id": package_id
            };

            if (customs) {
                params["customs"] = customs;
            }

            if (test !== undefined) {
                params['test'] = test;
            }
            return this.packages.call('get_label', [], params);
        },

        get_label_by_package: function (pkg, from_address, to_address, shipping, customs, test) {
            var params = {
                "shipping": shipping,
                "package": pkg,
                "from_address": from_address,
                "to_address": to_address
            };

            if (customs) {
                params["customs"] = customs;
            }

            if (test !== undefined) {
                params['test'] = test;
            }
            return this.packages.call('get_label', [], params);
        },

        // Convenience function for getting stats.
        get_stats: function (fromDate, toDate) {
            return this.packages.call('get_stats', [fromDate, toDate]);
        },

        get_usps_account: function (test) {
            kwargs = {}
            if (typeof (test) !== "undefined") {
                kwargs = {test: Boolean(test)}
            }
            return this.users.call('account_status', [], kwargs);
        },

        get_package_types: function () {
            return this.package_types.query(['code', 'length', 'width', 'height']).all();
        },

        get_sale_order: function (code) {
            return this.sales.call('get_by_quickship_code', [code]);
        },

        get_quickship_id: function (user_id) {
            kwargs = {}
            if (user_id) {
                kwargs["user_id"] = user_id;
            }
            return this.users.call('get_quickship_id', [], kwargs);
        }
    }))(_options);
};