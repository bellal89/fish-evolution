// Prints a summary of an exported world. Run: npx tsx scripts/inspect.ts <file>
import { loadSave, summarize } from './saveTools';

console.log(summarize(loadSave(process.argv[2]).world));
