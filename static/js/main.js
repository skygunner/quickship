openerp.quickship = function (instance) {
    var qs = new Namespace("ryepdx.openerp.quickship");

    instance.quickship = {};
    instance.quickship._api  = qs.ApiFactory(instance,
        {'url': window.location.protocol + '//' + window.location.href.split('/')[2]}
    );

    instance.quickship._actionAPI = new instance.web.ActionManager();

    // Client actions
    instance.quickship.create_package = function (parent, action) {
        return instance.quickship._api.create_package(action.params.sale_order, action.params.package,
            action.params.picker, action.params.packer, action.params.shipper
        );
    }
    instance.web.client_actions.add('quickship.create_package', "instance.quickship.create_package");

    instance.quickship.get_label = function (parent, action) {
        return instance.quickship._api.get_label(
            action.params.package_id, action.params.shipping, action.params.test);
    }
    instance.web.client_actions.add('quickship.get_label', "instance.quickship.get_label");

    instance.quickship.get_quotes = function (parent, action) {
        return instance.quickship._api.get_quotes(
            action.params.package_id, action.params.weight, action.params.test);
    }
    instance.web.client_actions.add('quickship.get_quotes', "instance.quickship.get_quotes");

    instance.quickship.Kiosk = instance.web.Widget.extend({
        template: "quickship.kiosk",
        start: function () {
            // Kick off our model, view, and controller classes.

            (new instance.web.Model('res.company')).call('get_proxy_settings').done(function (settings) {
                instance.quickship._printerAPI = new instance.printer_proxy.Printer({
                    name: "zebra", url: settings.printer.url,
                    username: settings.printer.username, password: settings.printer.password
                });
                instance.quickship._scaleAPI = new instance.scale_proxy.Scale({
                    url: settings.scale.url, username: settings.scale.username, password: settings.scale.password
                });

                var model = new qs.kiosk.Model(
                    instance.quickship._api, instance.quickship._printerAPI,
                    instance.quickship._scaleAPI, instance.quickship._actionAPI
                );

                var view = new qs.kiosk.View();

                var controllerOptions = {
                    message: {
                        error: function (text) {
                            instance.web.notification.warn("Error", text, true);
                        },
                        notify: function (text, title) {
                            instance.web.notification.notify(title ? title : "Notice", text);
                        }
                    }
                };

                var controller = new qs.kiosk.Controller(model, view, controllerOptions);
            });
        }
    });
    instance.web.client_actions.add('quickship.Kiosk', 'instance.quickship.Kiosk');

    instance.quickship.Stats = qs.Stats(instance);
    instance.web.client_actions.add('quickship.Stats', 'instance.quickship.Stats');
};
