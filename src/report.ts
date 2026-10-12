import type {RunReport} from './types.js';
export function formatReport(report:RunReport,json:boolean):string {
  if(json)return JSON.stringify(report);
  const lines=report.results.map(result=>`${result.passed?'PASS':'FAIL'} ${result.kind} ${result.name} (${result.code})`);
  return [...lines,report.passed?'Preflight passed.':'Preflight failed.'].join('\n');
}
