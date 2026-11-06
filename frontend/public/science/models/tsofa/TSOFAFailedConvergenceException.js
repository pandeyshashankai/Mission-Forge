/* Generated from Java with JSweet 3.1.0 - http://www.jsweet.org */
import { TSOFAException } from "./TSOFAException.js";
/**
 * Exception reporting some form of convergence failure in an algorithm.
 * @param {string} message
 * @param {number} status
 * @class
 * @extends TSOFAException
 */
export class TSOFAFailedConvergenceException extends TSOFAException {
    constructor(message, status) {
        super(message, status);
        Object.setPrototypeOf(this, TSOFAFailedConvergenceException.prototype);
    }
}
/**
 * Comment for <code>serialVersionUID</code>
 */
TSOFAFailedConvergenceException.__org_jastronomy_TSOFA_TSOFAFailedConvergenceException_serialVersionUID = 4417087001300889769;
TSOFAFailedConvergenceException["__class"] = "org.jastronomy.TSOFA.TSOFAFailedConvergenceException";
//# sourceMappingURL=TSOFAFailedConvergenceException.js.map