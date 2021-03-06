import { Compiler as WebpackCompiler } from "webpack";
import * as fs from "fs";

export interface AsyncStylesheetWebpackPluginOptions {
    preloadPolyfill?: boolean;
    noscriptFallback?: boolean;
    chunks?: string[];
    excludeChunks?: string[];
}

export default class AsyncStylesheetWebpackPlugin {

    protected options: AsyncStylesheetWebpackPluginOptions = {
        preloadPolyfill: false,
        noscriptFallback: true
    };

    public constructor(options: AsyncStylesheetWebpackPluginOptions = {}) {
        Object.assign(this.options, options);
    }

    public apply(compiler: WebpackCompiler): void {
        if (compiler.hooks == undefined) {
            // Webpack 3
            compiler.plugin('compilation', (compilation) => {
                compilation.plugin('html-webpack-plugin-alter-asset-tags', (data: any, next: (err: Error | null, data: any) => void) => {
                    next(null, this.makeStylesheetsAsync(data));
                });
            });
        } else {
            // Webpack 4
            compiler.hooks.compilation.tap("AsyncStylesheetWebpackPlugin", (compilation) => {
                (compilation.hooks as any).htmlWebpackPluginAlterAssetTags.tap("AsyncStylesheetWebpackPlugin", (data: any) => {
                    return this.makeStylesheetsAsync(data);
                });
            });
        }
    }

    public makeStylesheetsAsync(data: any): any {
        let noscriptTags: string[] = [];
        for (let tag of data.head) {
            if (tag.tagName === 'link' && tag.attributes.rel === 'stylesheet') {
                let chunk = this.getChunk(data.chunks, tag);
                if (chunk == null) {
                    continue;
                }
                if (this.options.chunks && this.options.chunks.indexOf(chunk) == -1) {
                    continue;
                }
                if (this.options.excludeChunks && this.options.excludeChunks.indexOf(chunk) > -1) {
                    continue;
                }
                let noscriptTagAttrs = Object.keys(tag.attributes).map((attr) => {
                    return attr + '="' + tag.attributes[attr] + '"';
                }).join(' ');
                noscriptTags.push('<link ' + noscriptTagAttrs + '>');
                tag.attributes.rel = 'preload';
                tag.attributes.as = 'style';
                tag.attributes.onload = tag.attributes.onload ? tag.attributes.onload : '';
                tag.attributes.onload += "this.onload=null;this.rel='stylesheet';";
            }
        }
        if (noscriptTags.length > 0) {
            if (this.options.noscriptFallback) {
                data.head.push({
                    tagName: 'noscript',
                    closeTag: true,
                    innerHTML: noscriptTags.join('')
                });
            }
            /**
             * rel=preload polyfill
             * See: https://github.com/filamentgroup/loadCSS#how-to-use-loadcss-recommended-example
             */
            if (this.options.preloadPolyfill) {
                // @see: https://github.com/webpack/webpack/issues/1554
                const cssrelpreloadPath = eval("require.resolve('fg-loadcss/dist/cssrelpreload.min.js')");
                data.head = [{
                    tagName: 'script',
                    attributes: {type: 'text/javascript'},
                    closeTag: true,
                    innerHTML: fs.readFileSync(cssrelpreloadPath, 'utf8')
                }].concat(data.head);
            }
        }
        return data;
    }

    protected getChunk(chunks: any[], tag: any): string | null {
        for (let chunk of chunks) {
            for (let file of chunk.files) {
                if (tag.attributes && tag.attributes.href && tag.attributes.href.endsWith(file)) {
                    return chunk.id;
                }
            }
        }
        return null;
    }

}
