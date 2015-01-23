var namespace = new Namespace("ryepdx.async.decorators");

/**
 * Wraps a function, passing it a $.Deferred object as its first argument in place
 * of a callback if no callback is passed in, and passing a $.Deferred mock with the
 * callback as the first argument if one *is* passed in.
 *
 * The last argument passed to a function is always assumed to be the callback argument.
 * If there are function arguments not supplied, then the wrapped function will always
 * return a $.Deferred.
 *
 * @param func
 * @returns {Function}
 */
namespace.deferrable = function (func) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        var callback = (func.length == args.length) ? args.pop() : false;
        var ret = { resolve: callback, reject: callback };

        if (!callback) {
            ret = new $.Deferred();
        }
        args.unshift(ret); // Push `ret` onto beginning of arguments list.

        func.apply(this, args);

        if (!callback) {
            return ret;
        }
    };
};