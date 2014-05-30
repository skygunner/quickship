Namespace("ryepdx.openerp.quickship").ApiFactory = function (instance) {
    return new (instance.web.Class.extend({
        init: function(options){
            options = options || {};

            this.rpc = new instance.web.JsonRPC();
            this.rpc.setup(options.url || 'http://localhost:8069');
            this.packages = new instance.web.Model('stock.packages');
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

        // Allows triggers to be set for when particular JSON-RPC function calls are made via 'message.'
        add_notification: function(name, callback){
            if(!this.notifications[name]){
                this.notifications[name] = [];
            }
            this.notifications[name].push(callback);
        },

        // Convenience function for creating a new package.
        create_package: function (sale_order, pkg, picker, packer, shipper) {
            return this.packages.call("create_package", {
                "sale_order": sale_order,
                "package": pkg,
                "picker_id": picker,
                "packer_id": packer,
                "shipper_id": shipper
            });
        },

        // Convenience function for getting quotes for a package.
        get_quotes: function (sale_id, pkg, test) {
            var kwargs = {};

            if (test !== undefined) {
                kwargs['test'] = test;
            }
            return this.packages.call('get_quotes', [sale_id, pkg], kwargs);
        },

        // Convenience function for getting the label for a package.
        get_label: function (package_id, shipping, test) {
            var params = {"shipping": shipping};

            if (test !== undefined) {
                params['test'] = test;
            }
            return this.packages.call('get_label', [package_id], params);
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
            return this.sales.query(['id', 'name']).filter([['name', '=', code]]).all();
        },

        get_quickship_id: function (user_id) {
            kwargs = {}
            if (user_id) {
                kwargs["user_id"] = user_id;
            }
            return this.users.call('get_quickship_id', [], kwargs);
        }
    }))();
};