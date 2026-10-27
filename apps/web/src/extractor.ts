import { Container } from "@cloudflare/containers";

type State = ConstructorParameters<typeof Container>[0];

type Runtime = NonNullable<State["container"]>;

// Matches the old `basic` instance type: 1/4 vCPU, 1 GiB memory, 4 GB disk.
const INSTANCE = { vcpu: 0.25, memoryMib: 1024, diskMb: 4000 };

// Reads a property off a workerd object, keeping native methods bound to it: called through the
// proxy they would run on the wrong receiver.
function forward(target: State | Runtime, property: string | symbol) {
  // oxlint-disable-next-line anti-slop/no-reflect-get -- A proxy trap receives any key; there is no domain type to parse into.
  const value: unknown = Reflect.get(target, property, target);

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Generic proxy forwarding: any property, method or not, passes through.
  return typeof value === "function" ? value.bind(target) : value;
}

// The `durable_object` scheduling policy leaves the image and size to whoever calls `start()`.
// shortcut: @cloudflare/containers 0.3.7 starts without them, so `start()` is wrapped to add them; drop once it accepts `image`/`instance`.
function withExtractorImage(ctx: State): State {
  const { container } = ctx;

  if (!container) {
    return ctx;
  }

  const wrapped = new Proxy(container, {
    get(target, property) {
      if (property === "start") {
        return (options?: ContainerStartupOptions) => {
          const image = target.images.extractor;

          if (!image) {
            throw new Error("extractor_image_missing");
          }

          // Rebuilt rather than spread: the options type forbids `image` next to a snapshot.
          target.start({
            enableInternet: options?.enableInternet ?? true,
            ...(options?.entrypoint && { entrypoint: options.entrypoint }),
            ...(options?.env && { env: options.env }),
            ...(options?.labels && { labels: options.labels }),
            image,
            instance: INSTANCE,
          });
        };
      }

      return forward(target, property);
    },
  });

  return new Proxy(ctx, {
    get(target, property) {
      if (property === "container") {
        return wrapped;
      }

      return forward(target, property);
    },
  });
}

// Container-backed Durable Object bound as `EXTRACTOR` in alchemy.run.ts. It forwards requests
// to the PDF text server on port 8080. Kept apart from `worker.ts` so the infra stack can import
// its type without pulling in the whole Worker.
export class Extractor extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";

  constructor(ctx: State, env: Cloudflare.Env) {
    super(withExtractorImage(ctx), env);
  }
}
