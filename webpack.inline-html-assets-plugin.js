const cheerio = require('cheerio');

class InlineHtmlAssetsPlugin {
  constructor(options = {}) {
    this.opt = {
      // Only the four options you asked to keep:
      leaveCSSFile: false,   // keep original .css asset file? (false = remove after inlining)
      leaveJSFile: false,    // keep original .js asset file?  (false = remove)
      keepLinkTag: false,    // keep original <link> tag alongside inline <style>?
      keepScriptTag: false,  // keep original <script src=...> tag?
      ...options,
    };
  }

  _makeId(name) {
    return `inlined-${name.replace(/[^\w-]/g, '_')}`;
  }

  _stripCharset(css) {
    return css.replace(/\s*@charset\s+["'][^"']+["'];?/gi, '');
  }

  apply(compiler) {
    const HtmlWebpackPlugin = require('html-webpack-plugin');

    compiler.hooks.thisCompilation.tap('InlineHtmlAssetsPlugin', compilation => {
      const hooks = HtmlWebpackPlugin.getHooks(compilation);

      hooks.beforeEmit.tap('InlineHtmlAssetsPlugin', data => {
        const $ = cheerio.load(data.html);
        const { assets } = compilation;

        // --- Inline CSS ---
        $('link[rel="stylesheet"][href$=".css"]').each((_, el) => {
          const $el = $(el);
          const href = $el.attr('href');
            if (!href || !assets[href]) return;

          const css = this._stripCharset(assets[href].source().toString());
          const styleTag = `<style id="${this._makeId(href)}">${css}</style>`;

          if (this.opt.keepLinkTag) {
            $el.before(styleTag);
          } else {
            $el.replaceWith(styleTag);
          }

          if (!this.opt.leaveCSSFile) {
            delete assets[href];
          }
        });

        // --- Inline JS ---
        $('script[src$=".js"]').each((_, el) => {
          const $el = $(el);
          const src = $el.attr('src');
          if (!src || !assets[src]) return;

          const js = assets[src].source().toString();
          const scriptTag = `<script id="${this._makeId(src)}" defer type="module">${js}</script>`;

          if (this.opt.keepScriptTag) {
            $el.before(scriptTag);
          } else {
            $el.replaceWith(scriptTag);
          }

          if (!this.opt.leaveJSFile) {
            delete assets[src];
          }
        });

        data.html = $.html();
        return data;
      });
    });
  }
}

module.exports = InlineHtmlAssetsPlugin;
