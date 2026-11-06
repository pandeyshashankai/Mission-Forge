/* Generated from Java with JSweet 3.1.0 - http://www.jsweet.org */
/**
 * Base class for TSOFA exceptions.
 * .
 * @author Paul Harrison (paul.harrison@manchester.ac.uk) 21 Nov 2011
 * @version $Revision$ $date$
 * @param {string} message
 * @param {number} status
 * @class
 * @extends Error
 */
export class TSOFAException extends Error {
    getStatus() {
        return this.status;
    }
    constructor(message, status) {
        super(message);
        this.message = message;
        Object.setPrototypeOf(this, TSOFAException.prototype);
        if (this.status === undefined) {
            this.status = 0;
        }
        this.status = status;
    }
}
/**
 * Comment for <code>serialVersionUID</code>
 */
TSOFAException.serialVersionUID = 4100437038026589596;
TSOFAException["__class"] = "org.jastronomy.TSOFA.TSOFAException";
//# sourceMappingURL=TSOFAException.js.map