// The crew: people who ride with Rex and pay off in small, real bonuses.
// One job: say who is in, and what each of them is worth on the street.
export const CREW = {
  milo: {
    name: 'Milo',
    role: 'Mechanic',
    bonus: 'Repairs your car to full at the start of every job',
  },
  vera: {
    name: 'Vera',
    role: 'Wheelwoman',
    bonus: '+$250 on every job once she joins',
  },
  tomas: {
    name: 'Tomas',
    role: 'Lookout',
    bonus: 'The police hold you 1.5s longer before a bust',
  },
};

export function makeCrew() {
  return { joined: [] }; // crew ids, in join order
}

// Add a member to the crew. Returns false when they are already in.
export function joinCrew(state, id) {
  const crew = state.crew;
  if (!crew || crew.joined.includes(id)) return false;
  crew.joined.push(id);
  return true;
}

export function hasCrew(state, id) {
  return !!state.crew && state.crew.joined.includes(id);
}

export function crewNames(state) {
  if (!state.crew) return [];
  return state.crew.joined.map((id) => CREW[id].name);
}
