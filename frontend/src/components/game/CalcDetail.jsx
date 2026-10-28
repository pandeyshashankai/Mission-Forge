export const CalcDetail = ({ calc, testId }) => {
  if (!calc) return null;
  return (
    <div data-testid={testId} className="space-y-3 text-xs">
      <div>
        <div className="eyebrow mb-1">Formula</div>
        <div className="inset rounded-sm px-3 py-2 font-mono text-cyan-300">{calc.formula}</div>
      </div>
      {calc.inputs?.length > 0 && (
        <div>
          <div className="eyebrow mb-1">Inputs</div>
          <table className="w-full font-mono">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-1 pr-2 font-normal">Quantity</th>
                <th className="py-1 pr-2 font-normal">Value</th>
                <th className="py-1 pr-2 font-normal">Unit</th>
                <th className="py-1 font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {calc.inputs.map((i, k) => (
                <tr key={k} className="border-t border-slate-800/80">
                  <td className="py-1 pr-2 text-slate-300">{i.name}</td>
                  <td className="py-1 pr-2 text-sky-300">{String(i.value)}</td>
                  <td className="py-1 pr-2 text-slate-500">{i.unit}</td>
                  <td className="py-1 text-slate-500">{i.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {calc.steps?.length > 0 && (
        <div>
          <div className="eyebrow mb-1">Calculation</div>
          <ol className="space-y-0.5 font-mono text-slate-300">
            {calc.steps.map((s, k) => (
              <li key={k}>
                <span className="mr-2 text-slate-600">{String(k + 1).padStart(2, "0")}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
      {calc.assumptions?.length > 0 && (
        <div>
          <div className="eyebrow mb-1">Assumptions</div>
          <ul className="list-disc space-y-0.5 pl-4 text-slate-400">
            {calc.assumptions.map((a, k) => (
              <li key={k}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
