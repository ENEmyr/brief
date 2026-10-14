/**
 * Inlined into <head> by app/layout.tsx so the theme is set before first
 * paint: the stored choice, else prefers-color-scheme. Readers who picked a
 * theme before the Console redesign have 'latte' or 'mocha' stored; those are
 * read as 'light' and 'dark' and written back, or every returning reader
 * would flip theme once.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('idocs:theme');if(t==='latte'||t==='mocha'){t=t==='mocha'?'dark':'light';localStorage.setItem('idocs:theme',t)}if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.setAttribute('data-theme',t)}catch(e){d.setAttribute('data-theme','light')}})()`
