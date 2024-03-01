const AllShrines = [
  "stasis",
  "cryonis",
  "magnesis",
  "bombs",
  "rotaOoh",
] as const;
type ShrineName = (typeof AllShrines)[number];
type Runes = "stasis" | "bombs";

type Route = {
  shrines: string[];
  time: number;
};

type TimeData = {
  [rune in Runes]?: number | null;
} & {
  none: number | null;
};

type InteriorsData = {
  [shrine in ShrineName]: {
    [rune in Runes]?: number | null;
  } & {
    none: number | null;
  };
};

type StartData = {
  [shrine in ShrineName]: number | null;
};

type EndData = InteriorsData;

type ShrineData<T> = {
  [K in Exclude<ShrineName, T>]: TimeData;
};

type Data = {
  start: StartData;
  interiors: InteriorsData;
  end: EndData;
} & {
  [shrine in ShrineName]: ShrineData<shrine>;
};

const debug: any[] = [];
const log = (...data: any[]) => {
  debug.push(data.join(" "));
};
const getAllRoutes = (data: Readonly<Data>) => {
  const out: Route[] = [];

  const getTime = (
    times: Readonly<TimeData>,
    hasBombs: boolean,
    hasStasis: boolean
  ): number | null => {
    let time = times.none;

    if (
      hasBombs &&
      times.hasOwnProperty("bombs") &&
      times.bombs !== null &&
      times.bombs !== undefined
    ) {
      if (time !== null) {
        if (times.bombs < time) {
          time = times.bombs;
        }
      } else {
        time = times.bombs;
      }
    }

    if (
      hasStasis &&
      times.hasOwnProperty("stasis") &&
      times.stasis !== null &&
      times.stasis !== undefined
    ) {
      if (time !== null) {
        if (times.stasis < time) {
          time = times.stasis;
        }
      } else {
        time = times.stasis;
      }
    }
    return time;
  };

  const propagateRoute = (route: Readonly<Route>) => {
    const shrines = route.shrines;

    if (isNaN(route.time)) {
      log("Time is NaN in route:", route.shrines.join(", "));
      return;
    }

    if (shrines.length == 4) {
      const hasBombs = shrines.includes("bombs");
      const hasStasis = shrines.includes("stasis");
      const mostRecentShrine = shrines[shrines.length - 1] as ShrineName;

      const endTimes: TimeData = data.end[mostRecentShrine];

      const endTime = getTime(endTimes, hasBombs, hasStasis);

      if (endTime === null) {
        log("Missing end data for route:", shrines.join(", "));
        return;
      }

      out.push({
        shrines: route.shrines,
        time: route.time + endTime,
      });
      return;
    }

    const hasBombs = shrines.includes("bombs");
    const hasStasis = shrines.includes("stasis");
    const mostRecentShrine = shrines[shrines.length - 1] as ShrineName;

    const shrineData = data[mostRecentShrine];
    Object.entries(shrineData).forEach(([_shrine, time]) => {
      if (time === null) {
        log(
          "Missing data! Cannot complete route:",
          [...shrines, _shrine].join(", "),
          "due to time of shrine:",
          _shrine,
          "being null, with bombs rune:",
          hasBombs,
          "and stasis rune:",
          hasStasis
        );
        return;
      }
      const shrine = _shrine as ShrineName;
      if (shrines.includes(shrine)) {
        log("Invalid route:", [...shrines, shrine].join(", "));
        return;
      }

      const exteriorTimes = data[mostRecentShrine][shrine as never] as TimeData;
      const exteriorTime = getTime(exteriorTimes, hasBombs, hasStasis);

      if (exteriorTime === null) {
        log(
          "Missing data! Cannot complete route:",
          [...shrines, shrine].join(", "),
          "Due to missing exterior data going from",
          mostRecentShrine,
          "to",
          shrine,
          "with bomb rune:",
          hasBombs,
          "and stasis rune:",
          hasStasis
        );
        return;
      }

      const nowHasBombs = hasBombs ? true : shrine === "bombs";
      const nowHasStasis = hasStasis ? true : shrine === "stasis";

      const interiorTime = getTime(
        data.interiors[shrine],
        nowHasBombs,
        nowHasStasis
      );

      if (interiorTime === null) {
        log(
          "Missing data! Cannot complete route:",
          [...shrines, shrine].join(", "),
          "Due to missing interior data in shrine:",
          shrine,
          "with bomb rune:",
          hasBombs,
          "and stasis rune:",
          hasStasis
        );
        return;
      }

      isNaN(exteriorTime) &&
        log(
          "Exterior Time is NaN!",
          exteriorTime,
          "This is likely an issue with data.json going from",
          mostRecentShrine,
          "to",
          shrine
        );
      isNaN(interiorTime) &&
        log(
          "Interior Time is NaN!",
          interiorTime,
          "This is likely an issue with data.json for shrine interior:",
          shrine
        );

      propagateRoute({
        shrines: [...shrines, shrine],
        time: route.time + exteriorTime + interiorTime,
      });
    });
  };

  Object.entries(data.start).forEach(([_shrine, time]) => {
    if (time === null) {
      log("Missing start data for shrine:", _shrine);
      return;
    }
    const shrine = _shrine as ShrineName;
    const interiorTime = data.interiors[shrine].none;
    if (interiorTime === null) {
      log("Missing interior data for shrine:", _shrine);
      return;
    }
    const route: Route = {
      shrines: [shrine],
      time: time + interiorTime,
    };

    propagateRoute(route);
  });

  return out;
};

const data = (await Bun.file("./data.json").json()) as Data;
const allRoutes = getAllRoutes(data);
const output: string[] = [];

allRoutes.sort((a, b) => {
  return a.time - b.time;
});

for (let i = 0; i < allRoutes.length; i++) {
  const route = allRoutes[i];
  const routeNumber = (i + 1).toString().padStart(2, "0");
  const routeShrines = route.shrines.join(", ");
  const routeTime = route.time.toFixed(2);

  output.push(`${routeNumber} | ${routeShrines} | ${routeTime}`);
}

Bun.write("./out/output.txt", output.join("\n"));
Bun.write("./out/debug.log", debug.join("\n"));
