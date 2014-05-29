var namespace = new Namespace("ryepdx.openerp.quickship");

namespace.Stats = function (instance) {
    return instance.web.Widget.extend({
        template: "quickship.stats",
        start: function () {
            var that = this;

            var refresh_stats = function () {
                var api = namespace.ApiFactory(instance);
                api.get_stats($("#from").val(), $("#to").val()).done(function (stats) {
                    var $tbody;
                    var user;

                    for (key in stats) {
                        $tbody = $("#" + key);
                        $("tr", $tbody).remove();

                        for (var i=0; i < stats[key].length; i++) {
                            user = stats[key][i];
                            $tbody.append("<tr><td>" + user.name + "</td>"
                                +"<td class=\"packages\">" + user.package_count + "</td></tr>");
                        }
                    }
                });
            };
            refresh_stats();

            $( "#from:not(.hasDatepicker)" ).datepicker({
              defaultDate: "+1w",
              changeMonth: true,
              numberOfMonths: 2,
              onClose: function( selectedDate ) {
                $( "#to" ).datepicker( "option", "minDate", selectedDate );
                refresh_stats();
              }
            });

            $( "#to:not(.hasDatepicker)" ).datepicker({
              defaultDate: "+1w",
              changeMonth: true,
              numberOfMonths: 2,
              onClose: function( selectedDate ) {
                $( "#from" ).datepicker( "option", "maxDate", selectedDate );
                refresh_stats();
              }
            });
        }
    });
};