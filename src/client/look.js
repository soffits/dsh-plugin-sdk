/** Styles and glyphs. Colours only through DSH theme tokens, so light and dark follow the Web UI. */

export const STYLE_ID = 'dsh-ui-actions-style'

export const CSS = `
.ua-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0}
.ua-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;max-width:100%;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;text-decoration:none;box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l3)}
.ua-btn span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ua-btn svg{flex:none;width:14px;height:14px}
.ua-btn:disabled{cursor:default;opacity:.7}
@media (hover:hover){.ua-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}}
.ua-icon{width:32px;padding:0;box-shadow:none;color:var(--dsw-alias-label-tertiary)}
.ua-btn[data-state=pending] svg,.ua-btn[data-state=sending] svg{animation:ua-pulse 1.2s ease-in-out infinite}
.ua-btn[data-state=done]{color:var(--dsw-alias-state-success-primary)}
.ua-btn[data-state=unhandled]{color:var(--dsw-alias-state-warn-label,var(--dsw-alias-state-warn-primary))}
@keyframes ua-pulse{50%{opacity:.35}}
.ua-wrap{position:relative;display:inline-flex;max-width:100%;flex-wrap:wrap;align-items:center;gap:4px 8px}
.ua-menu{position:absolute;z-index:20;top:calc(100% + 4px);right:0;min-width:168px;padding:4px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));box-shadow:0 6px 24px #0000001f,inset 0 0 0 .5px var(--dsw-alias-border-l2);display:flex;flex-direction:column}
.ua-menu button{display:flex;align-items:center;gap:8px;min-height:36px;padding:7px 10px;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
@media (hover:hover){.ua-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.ua-menu input{margin:4px 6px;min-height:36px;padding:6px 8px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:16px}
.ua-menuRow{display:flex;justify-content:flex-end;gap:4px;padding:2px 4px}
.ua-error{flex-basis:100%;color:var(--dsw-alias-state-error-primary);font-size:12px;overflow-wrap:anywhere}
@media (width<=768px),(pointer:coarse){
.ua-btn{min-height:40px}
.ua-icon{width:40px}
.ua-menu{position:fixed;z-index:1000;top:auto;left:12px;right:12px;bottom:12px;max-height:60vh;overflow:auto;padding:8px;box-shadow:0 8px 40px #00000040,inset 0 0 0 .5px var(--dsw-alias-border-l2)}
.ua-menu button{min-height:44px;font-size:15px}
.ua-menu input{min-height:44px}
}
.ua-break{flex-basis:100%;height:0}
.ua-stepWrap{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 8px;max-width:100%}
.ua-step{box-sizing:border-box;display:inline-flex;align-items:flex-start;gap:8px;min-height:32px;max-width:100%;padding:6px 12px;border:0;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);color:var(--dsw-alias-state-business-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer;white-space:normal;overflow-wrap:anywhere}
.ua-step svg{flex:none;width:14px;height:14px;margin-top:3px}
@media (hover:hover){.ua-step:hover:not(:disabled):not([data-state=started]){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}}
.ua-step:disabled{cursor:default}
.ua-step[data-state=starting] svg{animation:ua-pulse 1.2s ease-in-out infinite}
.ua-step[data-state=started]{background:transparent;box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);cursor:default}
.ua-step[data-state=started] svg{color:var(--dsw-alias-state-success-primary)}
.ua-stepOpen{border:0;background:none;padding:4px 2px;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
@media (width<=640px){.ua-stepWrap,.ua-step{width:100%}.ua-step{min-height:40px;padding:9px 12px}}
.ua-item{box-sizing:border-box;display:inline-flex;align-items:center;gap:10px;vertical-align:top;width:min(100%,320px);max-width:100%;padding:8px 12px 8px 8px;border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);text-align:left;white-space:normal;line-height:18px}
.ua-itemIcon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-secondary)}
.ua-itemIcon svg{width:18px;height:18px}
.ua-itemText{display:flex;flex-direction:column;min-width:0;flex:1}
.ua-itemText span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ua-itemSource{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.ua-itemTitle{font-size:13px;font-weight:500}
.ua-itemLine{color:var(--dsw-alias-label-secondary);font-size:12px}
`

/** 16-unit stroke paths. */
export const PATHS = {
  chat: 'M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5A1.5 1.5 0 0 1 11.5 11H7l-3 2.5V11h.5A1.5 1.5 0 0 1 3 9.5z',
  done: 'M3.5 8.5l3 3 6-7',
  snooze: 'M8 4.5V8l2.2 1.4M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z',
  event: 'M8.8 2.5 4 9h4l-.8 4.5L12 7H8z',
  link: 'M6 3.5H3.5v9h9V10M9 3h4v4M13 3 7.5 8.5',
  pending: 'M8 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  unhandled: 'M8 3.5v5.5M8 12v.5',
  step: 'M3 8h8.5M8.5 4.5 12 8l-3.5 3.5',
  item: 'M3.5 2.5h6l3 3v8h-9zM9.5 2.5v3h3M5.5 8.5h5M5.5 11h3.5',
}
