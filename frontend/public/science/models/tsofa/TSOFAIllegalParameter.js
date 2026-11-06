/* Generated from Java with JSweet 3.1.0 - http://www.jsweet.org */
import { TSOFAException } from "./TSOFAException.js";
/**
 * Various forms of illegal parameters are reported with this execption.
 * .
 * @author Paul Harrison (paul.harrison@manchester.ac.uk) 21 Nov 2011
 * @version $Revision$ $date$
 * @param {string} message
 * @param {number} status
 * @class
 * @extends org.jastronomy.TSOFA.TSOFAException
 */
export class TSOFAIllegalParameter extends TSOFAException {
    constructor(message, status) {
        super(message, status);
        Object.setPrototypeOf(this, TSOFAIllegalParameter.prototype);
    }
}
/**
 * Comment for <code>serialVersionUID</code>
 */
TSOFAIllegalParameter.__org_jastronomy_jsofa_TSOFAIllegalParameter_serialVersionUID = 4164536110692125140;
TSOFAIllegalParameter["__class"] = "org.jastronomy.jsofa.TSOFAIllegalParameter";
//# sourceMappingURL=TSOFAIllegalParameter.js.map