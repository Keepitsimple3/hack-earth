export function optimizeEVs(evs, required) {
  let remaining = required;
  let plan = [];

  for (const ev of evs) {
    if (remaining <= 0) break;

    const give = Math.min(ev.available, remaining);
    plan.push({ id: ev.id, give });
    remaining -= give;
  }

  return plan;
}
