const FUNCTIONS = {
  sin: (value, mode) => Math.sin(toRadians(value, mode)),
  cos: (value, mode) => Math.cos(toRadians(value, mode)),
  tan: (value, mode) => Math.tan(toRadians(value, mode)),
  asin: (value, mode) => fromRadians(Math.asin(value), mode),
  acos: (value, mode) => fromRadians(Math.acos(value), mode),
  atan: (value, mode) => fromRadians(Math.atan(value), mode),
  sqrt: (value) => Math.sqrt(value),
  cbrt: (value) => Math.cbrt(value),
  abs: (value) => Math.abs(value),
  ln: (value) => Math.log(value),
  log: (value) => Math.log10(value),
  exp: (value) => Math.exp(value),
  floor: (value) => Math.floor(value),
  ceil: (value) => Math.ceil(value),
  round: (value) => Math.round(value),
  min: (...values) => Math.min(...values),
  max: (...values) => Math.max(...values),
  pow: (base, exponent) => Math.pow(base, exponent),
};

const CONSTANTS = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

function toRadians(value, mode) {
  return mode === "degrees" ? (value * Math.PI) / 180 : value;
}

function fromRadians(value, mode) {
  return mode === "degrees" ? (value * 180) / Math.PI : value;
}

function tokenize(input) {
  const tokens = [];
  let index = 0;
  while (index < input.length) {
    const source = input.slice(index);
    const space = source.match(/^\s+/);
    if (space) {
      index += space[0].length;
      continue;
    }

    const number = source.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }

    const identifier = source.match(/^[A-Za-z_π][A-Za-z0-9_π]*/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0].toLowerCase() });
      index += identifier[0].length;
      continue;
    }

    const char = source[0];
    if ("+-*/%^(),".includes(char)) {
      tokens.push({ type: char, value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character “${char}”.`);
  }
  tokens.push({ type: "eof" });
  return tokens;
}

class Parser {
  constructor(tokens, angleMode) {
    this.tokens = tokens;
    this.angleMode = angleMode;
    this.index = 0;
  }

  current() {
    return this.tokens[this.index];
  }

  take(type) {
    if (this.current().type !== type) return null;
    const token = this.current();
    this.index += 1;
    return token;
  }

  expect(type) {
    const token = this.take(type);
    if (!token) throw new Error(`Expected “${type}”.`);
    return token;
  }

  parse() {
    const value = this.additive();
    if (this.current().type !== "eof") throw new Error("Check the expression after the result.");
    return value;
  }

  additive() {
    let value = this.multiplicative();
    while (["+", "-"].includes(this.current().type)) {
      const operator = this.current().type;
      this.index += 1;
      const right = this.multiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  multiplicative() {
    let value = this.exponent();
    while (["*", "/", "%"].includes(this.current().type)) {
      const operator = this.current().type;
      this.index += 1;
      const right = this.exponent();
      if ((operator === "/" || operator === "%") && right === 0) throw new Error("Division by zero is undefined.");
      if (operator === "*") value *= right;
      if (operator === "/") value /= right;
      if (operator === "%") value %= right;
    }
    return value;
  }

  exponent() {
    const left = this.unary();
    if (this.take("^")) return Math.pow(left, this.exponent());
    return left;
  }

  unary() {
    if (this.take("+")) return this.unary();
    if (this.take("-")) return -this.unary();
    return this.primary();
  }

  primary() {
    const number = this.take("number");
    if (number) return number.value;

    if (this.take("(")) {
      const value = this.additive();
      this.expect(")");
      return value;
    }

    const identifier = this.take("identifier");
    if (!identifier) throw new Error("Enter a number, constant, or function.");
    if (Object.prototype.hasOwnProperty.call(CONSTANTS, identifier.value)) return CONSTANTS[identifier.value];
    const fn = FUNCTIONS[identifier.value];
    if (!fn) throw new Error(`Unknown function “${identifier.value}”.`);
    this.expect("(");
    const args = [];
    if (this.current().type !== ")") {
      args.push(this.additive());
      while (this.take(",")) args.push(this.additive());
    }
    this.expect(")");
    if (!args.length) throw new Error(`${identifier.value} needs at least one value.`);
    return fn(...args, this.angleMode);
  }
}

export function evaluateExpression(expression, angleMode = "degrees") {
  const input = String(expression || "").trim();
  if (!input) throw new Error("Enter an expression.");
  const value = new Parser(tokenize(input), angleMode).parse();
  if (!Number.isFinite(value)) throw new Error("The result is not a finite number.");
  return Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
}

export function formatResult(value) {
  if (!Number.isFinite(value)) return String(value);
  const absolute = Math.abs(value);
  if ((absolute !== 0 && absolute < 1e-7) || absolute >= 1e12) return value.toExponential(8);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 }).format(value);
}

export const SCIENTIFIC_KEYS = [
  "sin(", "cos(", "tan(", "sqrt(", "log(", "ln(", "abs(", "π", "e", "^", "(", ")",
];
