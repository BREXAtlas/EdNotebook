import { useState } from "react";
import { evaluateExpression, formatResult, SCIENTIFIC_KEYS } from "./calculator.js";

const NUMBER_KEYS = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"];

export default function ScientificCalculator() {
  const [expression, setExpression] = useState("sin(30)^2 + cos(30)^2");
  const [angleMode, setAngleMode] = useState("degrees");
  const [result, setResult] = useState("1");
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  function calculate(event) {
    event?.preventDefault();
    try {
      const value = evaluateExpression(expression, angleMode);
      const display = formatResult(value);
      setResult(display);
      setError("");
      setHistory((items) => [{ expression, result: display, angleMode }, ...items].slice(0, 8));
    } catch (calculationError) {
      setError(calculationError.message || "The expression could not be calculated.");
    }
  }

  return (
    <div className="studio-tool-grid is-calculator">
      <form className="studio-calculator" onSubmit={calculate}>
        <div className="studio-calculator-display">
          <div className="studio-calculator-mode">
            <button type="button" className={angleMode === "degrees" ? "is-active" : ""} onClick={() => setAngleMode("degrees")}>DEG</button>
            <button type="button" className={angleMode === "radians" ? "is-active" : ""} onClick={() => setAngleMode("radians")}>RAD</button>
          </div>
          <label>
            Expression
            <input value={expression} onChange={(event) => setExpression(event.target.value)} aria-label="Scientific calculator expression" />
          </label>
          <output>{error ? <span className="is-error">{error}</span> : result}</output>
        </div>
        <div className="studio-scientific-keys">
          {SCIENTIFIC_KEYS.map((key) => (
            <button key={key} type="button" onClick={() => setExpression((value) => `${value}${key}`)}>{key}</button>
          ))}
        </div>
        <div className="studio-number-keys">
          {NUMBER_KEYS.map((key) => (
            <button key={key} type="button" onClick={() => setExpression((value) => `${value}${key}`)}>{key}</button>
          ))}
          <button type="button" onClick={() => setExpression("")}>Clear</button>
          <button type="button" onClick={() => setExpression((value) => value.slice(0, -1))}>⌫</button>
          <button className="is-equals" type="submit">=</button>
        </div>
      </form>

      <aside className="studio-calculator-history">
        <span className="studio-kicker">CALCULATION HISTORY</span>
        <h3>Reusable, inspectable work</h3>
        <p>Learners can reopen an expression instead of receiving only an unexplained answer.</p>
        {history.length === 0 ? (
          <div className="studio-tool-empty">Results will appear here.</div>
        ) : history.map((item, index) => (
          <button
            type="button"
            key={`${item.expression}-${index}`}
            onClick={() => {
              setExpression(item.expression);
              setResult(item.result);
              setAngleMode(item.angleMode);
            }}
          >
            <code>{item.expression}</code>
            <strong>{item.result}</strong>
            <small>{item.angleMode}</small>
          </button>
        ))}
      </aside>
    </div>
  );
}
