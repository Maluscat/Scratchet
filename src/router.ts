import * as denoPath from 'path';
import { Application, Router } from 'oak';
import Nunjucks from 'nunjucks';
 
const VIEWS_DIR = denoPath.join(Deno.cwd(), 'views/');
const STATIC_DIR = denoPath.join(Deno.cwd(), 'static/');

// IN CASE OF 'INTERNAL SERVER ERROR': --allow-read IS MISSING
export const app = new Application();
export const router = new Router();
const njkEnv = new Nunjucks.configure(VIEWS_DIR);


// ---- Oak boilerplate stuff ----
app.use(router.routes());
app.use(router.allowedMethods());

app.use(async (ctx, next) => {
  await next();
  if (ctx.request.url.pathname === '/') {
    ctx.response.status = 200;
    ctx.response.body = njkEnv.render('index.njk');
  }
});

// static routing with 404 fallback
app.use(async (ctx, next) => {
  await next();
  try {
    let path = ctx.request.url.pathname;
    path = skipPath(path, '/script/library/slider89/', 'dist/');

    await ctx.send({
      root: STATIC_DIR,
      path: path
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body = '404';
  }
});

app.addEventListener('listen', function(e) {
  console.log("Listening on port ༼ つ ◕_◕ ༽つ " + e.port);
});


function skipPath(path: string, pathPrefix: string, pathSkip: string) {
  if (path.startsWith(pathPrefix)) {
    path = pathPrefix + pathSkip + path.slice(pathPrefix.length);
  }
  return path;
}
