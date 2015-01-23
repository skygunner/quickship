Namespace('ryepdx.components')
    .InputPrompt = (function () {
        var InputPrompt = function (element, options) {
            this.input = "";
            this.$elem = $(element);
            this.$lock = null;
            this.$nextElem = $("body");
            this.settings = $.extend({
                lock: true
            }, options);

            this.init();
        };

        InputPrompt.prototype.init = function () {
            var that = this;

            if (that.settings.lock == true) {
                that._addLock();
            }

            that.$elem.on("keyup", function (e) {
                if (e.keyCode == 17) { // Ctrl
                    that.toggleLock();
                }

                if (that.$elem.val().length >= parseInt(that.$elem.attr("maxlength"))) {
                    that.nextElem();
                }
            }).on("keypress", function (e) {
                if (e.keyCode == 13) { // Enter
                    that.nextElem();
                }
            });

            that.$elem.on("focus", function (e) {
                if (!that.$elem.is(":visible") || (that.settings.lock !== true && that.isLocked())) {
                    setTimeout(function () { that.nextElem() }, 0);
                } else if (that.isLocked() && that.$elem.val() !== "") {
                    setTimeout(function () { that.nextElem() }, 100);
                } else {
                    that.$elem.val("");
                }
            });
        };

        InputPrompt.prototype.updateOptions = function (options) {
            this.settings = $.extend(this.settings, options);
        };

        InputPrompt.prototype.toggleLock = function () {
            if (!this.settings.lock || this.$lock == null) {
                console.error("Cannot lock InputPrompt, as InputPrompt is not lockable!");
                return;
            }
            this.$lock.click();
        };

        InputPrompt.prototype.isLocked = function () {
            return (this.settings.lock == true && this.$elem.parent().data("locked"))
                || (this.settings.lock && this.settings.lock !== true && this.settings.lock());
        };

        InputPrompt.prototype._addLock = function () {
            this.$lock = $("<i class='foundicon-unlock'></i>");
            this.$elem.after(this.$lock);

            this.$lock.parent().data("locked", this.$lock.hasClass("foundicon-lock"));

            this.$lock.on("click", function () {
                var $this = $(this);
                $this.toggleClass("foundicon-lock");
                $this.toggleClass("foundicon-unlock");
                $this.parent().data("locked", $this.hasClass("foundicon-lock"));
            });
        };

        InputPrompt.prototype.setNextElem = function (elem) {
            this.$nextElem = $(elem);
        }

        InputPrompt.prototype.nextElem = function () {
            this.$elem.blur();
            this.$nextElem.focus();
        };

        return InputPrompt;
    })();

// Hook up the InputPrompt class to jQuery's plugin system.
(function ($) {
    $.fn.inputPrompt = function (options) {
        var prevPrompt = null;
        this.each(function (i) {
            var inputPrompt = $.data(this, 'inputPrompt');

            // Only create a new InputPrompt if one has not already been
            // assigned to the object.
            if (typeof(inputPrompt) === "undefined") {
                inputPrompt = new ryepdx.components.InputPrompt(this, options);
                $.data(this, 'inputPrompt', inputPrompt);

                if (prevPrompt !== null) {
                    prevPrompt.setNextElem(this);
                }

            // Otherwise just update the InputPrompt's options.
            } else {
                inputPrompt.updateOptions(options);
            }
            prevPrompt = inputPrompt;
        });
        return prevPrompt;
    };
})(jQuery);