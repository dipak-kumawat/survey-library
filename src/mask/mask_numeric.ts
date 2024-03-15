import { Serializer, property } from "../jsonobject";
import { InputMaskBase } from "./mask_base";
import { IMaskedInputResult, ITextInputParams, numberDefinition } from "./mask_utils";

interface INumericalComposition {
  integralPart: string;
  fractionalPart: string;
  isNegative?: boolean;
  hasDecimalSeparator?: boolean;
}

export function splitString(str: string, reverse = true, n = 3): Array<string> {
  let arr = [];

  if(reverse) {
    for (let i = str.length - n; i > -n; i -= n) {
      arr.push(str.substring(i, i + n));
    }
    arr = arr.reverse();
  } else {
    for (let i = 0; i < str.length; i += n) {
      arr.push(str.substring(i, i + n));
    }
  }

  return arr;
}

/**
 * A class that describes an input mask of the `"numeric"` [`maskType`](https://surveyjs.io/form-library/documentation/api-reference/text-entry-question-model#maskType).
 *
 * The following code shows how to specify the properties of this class within a survey JSON schema:
 *
 * ```js
 * const surveyJson = {
 *   "elements": [{
 *     "name": "textquestion1"
 *     "type": "text",
 *     "maskType": "numeric",
 *     "maskSettings": {
 *       // Specify the properties of a numeric input mask here
 *     }
 *   }]
 * }
 * ```
 */
export class InputMaskNumeric extends InputMaskBase {
  /**
   * Specifies whether respondents can enter negative values.
   *
   * Default value: `true`
   * @see min
   * @see max
   */
  @property() allowNegativeValues: boolean;
  /**
   * A symbol used to separate the fractional part from the integer part of a displayed number.
   *
   * Default value: `"."`
   * @see precision
   * @see thousandsSeparator
   */
  @property() decimalSeparator: string;
  /**
   * Limits how many digits to retain after the decimal point for a displayed number.
   *
   * Default value: 2
   * @see decimalSeparator
   */
  @property() precision: number;
  /**
   * A symbol used to separate the digits of a large number into groups of three.
   *
   * Default value: `","`
   * @see decimalSeparator
   */
  @property() thousandsSeparator: string;
  /**
   * A minimum value that respondents can enter.
   * @see max
   * @see allowNegativeValues
   */
  @property() min: number;
  /**
   * A maximum value that respondents can enter.
   * @see min
   * @see allowNegativeValues
   */
  @property() max: number;

  private calccaretPosition(leftPart: string, args: ITextInputParams, maskedValue: string) {
    const leftPartMaskedLength = !! leftPart ? this.displayNumber(this.parseNumber(leftPart), false).length : 0;
    let validCharIndex = 0;
    let result = args.selectionStart;
    // let result = 0;
    const isDeleteKeyOperation = !args.insertedChars && args.inputDirection === "forward";

    for (let index = 0; index < maskedValue.length; index++) {
      const currentChar = maskedValue[index];
      if (currentChar !== this.thousandsSeparator) {
        validCharIndex++;
      }
      if (validCharIndex === (leftPartMaskedLength + (isDeleteKeyOperation ? 1 : 0))) {
        if(isDeleteKeyOperation) {
          result = index;
        } else {
          result = index + 1;
        }
        break;
      }
      // if (validCharIndex === leftPartMaskedLength) {
      //   result = index + 1;
      //   break;
      // }
    }
    return result;
  }

  public displayNumber(parsedNumber: INumericalComposition, insertThousandsSeparator = true, matchWholeMask: boolean = false): string {
    let displayIntegralPart = parsedNumber.integralPart;
    if(insertThousandsSeparator && !!displayIntegralPart) {
      displayIntegralPart = splitString(displayIntegralPart).join(this.thousandsSeparator);
    }
    let displayFractionalPart = parsedNumber.fractionalPart;
    const minusSign = parsedNumber.isNegative ? "-" : "";
    if(displayFractionalPart === "") {
      if(matchWholeMask) {
        return (!displayIntegralPart || displayIntegralPart === "0") ? displayIntegralPart : minusSign + displayIntegralPart;
      } else {
        const displayDecimalSeparator = parsedNumber.hasDecimalSeparator && !matchWholeMask ? this.decimalSeparator : "";
        const src = displayIntegralPart + displayDecimalSeparator;
        return src === "0" ? src : minusSign + src;
      }
    } else {
      displayIntegralPart = displayIntegralPart || "0";
      displayFractionalPart = displayFractionalPart.substring(0, this.precision);
      return [minusSign + displayIntegralPart, displayFractionalPart].join(this.decimalSeparator);
    }
  }

  public convertNumber(parsedNumber: INumericalComposition): number {
    let value;
    const minusSign = parsedNumber.isNegative ? "-" : "";
    if(!!parsedNumber.fractionalPart) {
      value = parseFloat(minusSign + (parsedNumber.integralPart || "0") + "." + parsedNumber.fractionalPart.substring(0, this.precision));
    } else {
      value = parseInt(minusSign + parsedNumber.integralPart || "0");
    }
    return value;
  }

  public validateNumber(number: INumericalComposition): boolean {
    const min = this.min || Number.MIN_SAFE_INTEGER;
    const max = this.max || Number.MAX_SAFE_INTEGER;

    if(this.min !== undefined || this.max !== undefined) {
      let value = this.convertNumber(number);
      if(Number.isNaN(value)) {
        return true;
      }
      return value >= min && value <= max;
    }
    return true;
  }

  public parseNumber(src: string | number): INumericalComposition {
    const result: INumericalComposition = { integralPart: "", fractionalPart: "", hasDecimalSeparator: false, isNegative: false };
    let input = (src === undefined || src === null) ? "" : src.toString();
    if(typeof src === "number") {
      input = src.toString().replace(".", this.decimalSeparator);
    }
    let minusCharCount = 0;

    for(let inputIndex = 0; inputIndex < input.length; inputIndex++) {
      const currentChar = input[inputIndex];
      switch(currentChar) {
        case "-": {
          if(this.allowNegativeValues) {
            minusCharCount++;
          }
          break;
        }
        case this.decimalSeparator: {
          if(this.precision > 0) {
            result.hasDecimalSeparator = true;
          }
          break;
        }
        case this.thousandsSeparator: {
          break;
        }
        default: {
          if(currentChar.match(numberDefinition)) {
            if(result.hasDecimalSeparator) {
              result.fractionalPart += currentChar;
            } else {
              result.integralPart += currentChar;
            }
          }
        }
      }
    }

    result.isNegative = minusCharCount % 2 !== 0;

    if(result.integralPart.length > 1 && result.integralPart[0] === "0") {
      result.integralPart = result.integralPart.slice(1);
    }

    return result;
  }

  public getNumberMaskedValue(src: string | number, matchWholeMask: boolean = false): string {
    const input = (src === undefined || src === null) ? "" : src;
    const parsedNumber = this.parseNumber(input);
    const displayText = this.displayNumber(parsedNumber, true, matchWholeMask);
    return displayText;
  }

  private getNumberUnmaskedValue(str: string): number {
    const parsedNumber = this.parseNumber(str);
    return this.convertNumber(parsedNumber);
  }

  public getMaskedValue(src: any): string {
    return this.getNumberMaskedValue(src, true);
  }
  public getUnmaskedValue(src: string): any {
    return this.getNumberUnmaskedValue(src);
  }
  public processInput(args: ITextInputParams): IMaskedInputResult {
    const result = { value: args.prevValue, caretPosition: args.selectionEnd, cancelPreventDefault: false };
    const leftPart = args.prevValue.slice(0, args.selectionStart) + (args.insertedChars || "");
    const rightPart = args.prevValue.slice(args.selectionEnd);
    const src = leftPart + rightPart;
    const parsedNumber = this.parseNumber(src);

    if(!this.validateNumber(parsedNumber)) {
      return result;
    }

    const maskedValue = this.getNumberMaskedValue(src);
    const caretPosition = this.calccaretPosition(leftPart, args, maskedValue);
    result.value = maskedValue;
    result.caretPosition = caretPosition;

    return result;
  }

  public getType(): string {
    return "numericmask";
  }

  protected isPropertyEmpty(value: any): boolean {
    return value === "" || value === undefined || value === null;
  }
}

Serializer.addClass(
  "numericmask",
  [
    { name: "allowNegativeValues:boolean", default: true },
    { name: "decimalSeparator", default: ".", maxLength: 1 },
    { name: "thousandsSeparator", default: ",", maxLength: 1 },
    { name: "precision:number", default: 2, minValue: 0 },
    { name: "min:number" },
    { name: "max:number" },
  ],
  function () {
    return new InputMaskNumeric();
  },
  "masksettings"
);