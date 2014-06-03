openerp.testing.section('integration smoke test', function (test){
    test('get shipping options', {rpc: 'rpc', asserts: 1}, function (instance) {
        var ret = new $.Deferred();
        var api = new instance.quickship.API();

        api.get_quotes({}, 1, null, null, true).done(function(result) { // getQuotes with only a sale ID
            ok(result.quotes.length > 0, "server returned without error");
            ret.resolve(result);
        }).fail(function(error) {
            console.log(error);
            ok(false, "server threw error");
            ret.reject(error);
        });
        return ret;
    });

    test('get shipping label', {rpc: 'rpc', asserts: 1}, function (instance) {
        var ret = new $.Deferred();
        var api = new instance.quickship.API();

        api.get_label(1, {
                    "service": "",
                    "company": "USPS",
                    "weight": {"value": 5.10, "unit": "pound"}
                }, true
        ).done(function(result) {
            ok(Boolean(result.label) && !("error" in result),
                "server returned without error");
            ret.resolve(result);
        }).fail(function(error) {
            console.log(error);
            ok(false, "server threw error");
            ret.reject(error);
        });
        return ret;
    });
});