Namespace("ryepdx.openerp.quickship").ApiFactory = function (instance) {
    return new (instance.web.Class.extend({
        init: function(options){
            options = options || {};

            this.connection = new instance.web.JsonRPC();
            this.connection.setup(options.url || 'http://localhost:8069');
            this.model = new instance.web.Model('stock.packages');
            this.notifications = {};
        },

        // Makes a JSON-RPC call to the local OpenERP server.
        rpc : function(endpoint, name,params){
            var ret = new $.Deferred();
            var callbacks = this.notifications[name] || [];
            for(var i = 0; i < callbacks.length; i++){
                callbacks[i](params);
            }

            this.connection.rpc('/' + endpoint + '/' + name, params || {}).done(function(result) {
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
            return this.model.call("create_package", {
                "sale_order": sale_order,
                "package": pkg,
                "picker_id": picker,
                "packer_id": packer,
                "shipper_id": shipper
            });
        },

        // Convenience function for getting quotes for a package.
        get_quotes: function (package_id, test) {
            var params = {};

            if (test !== undefined) {
                params['test'] = test;
            }
            return this.model.call('get_quotes', [package_id], params);
        },

        // Convenience function for getting the label for a package.
        get_label: function (package_id, shipping, test) {
            var params = {"shipping": shipping};

            if (test !== undefined) {
                params['test'] = test;
            }
            return this.model.call('get_label', [package_id], params);
        },

        // Convenience function for getting stats.
        get_stats: function (fromDate, toDate) {
            return this.model.call('get_stats', [fromDate, toDate]);
        }
    }))();
};