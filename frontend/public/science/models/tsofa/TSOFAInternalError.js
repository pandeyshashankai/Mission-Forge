/* Generated from Java with JSweet 3.1.0 - http://www.jsweet.org */
import { TSOFAException } from "./TSOFAException.js";
/**
 * Exception signalling a internal error.
 * .
 * @author Paul Harrison (paul.harrison@manchester.ac.uk) 21 Nov 2011
 * @version $Revision$ $date$
 * @param {string} message
 * @param {number} status
 * @class
 * @extends org.jastronomy.jsofa.TSOFAException
 */
export class TSOFAInternalError extends TSOFAException {
    constructor(message, status) {
        super(message, status);
        Object.setPrototypeOf(this, TSOFAInternalError.prototype);
    }
}
/**
 * Comment for <code>serialVersionUID</code>
 */
TSOFAInternalError.__org_jastronomy_jsofa_TSOFAInternalError_serialVersionUID = 6067803703985219165;
TSOFAInternalError["__class"] = "org.jastronomy.jsofa.TSOFAInternalError";
//# sourceMappingURL=TSOFAInternalError.js.map