"use client";

const activities = [
  {
    title: "Morning Golf",
    time: "Friday, Aug 21 — ~9am",
    description:
      "Booking a round at [PLACEHOLDER COURSE]. Meet at the house and head over together.",
  },
  {
    title: "BBQ",
    time: "Friday, Aug 21 — ~1pm",
    description: "Back at the house. Food and drinks all afternoon.",
  },
  {
    title: "Liftlock Cruise",
    time: "Friday, Aug 21 — ~3pm",
    description:
      "2-hour sightseeing cruise from Peterborough Marina. Goes through the world's highest hydraulic liftlock. Boat holds up to 92 passengers. Cash bar on board. $35/person, cash only.",
  },
  {
    title: "Backyard Campfire",
    time: "Friday, Aug 21 — evening",
    description: "Fire pit. Bring a chair or a sleeping bag.",
  },
  {
    title: "Goatchella",
    time: "Saturday, Aug 22",
    description:
      "Group trip to Haute Goat Farm in Newtonville. If enough people are in, we hire a bus.",
  },
];

export function ActivityCards() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {activities.map((activity) => (
        <div
          key={activity.title}
          className="activity-card bg-card-bg border border-card-border rounded-2xl p-6 flex flex-col"
        >
          <h3 className="text-xl font-bold mb-1">{activity.title}</h3>
          <p className="text-accent-soft text-sm mb-3">{activity.time}</p>
          <p className="text-muted text-sm leading-relaxed flex-1">
            {activity.description}
          </p>
        </div>
      ))}
    </div>
  );
}
