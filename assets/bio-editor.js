/* ==========================================================================
   Bio editor for the admin page
   --------------------------------------------------------------------------
   Turns a plain <textarea> into a small writing tool:
     - Tab / Shift+Tab indent and outdent (works on several selected lines)
     - Bold / Italic / Indent / Outdent buttons (+ Ctrl/Cmd+B, Ctrl/Cmd+I)
     - live preview that uses the exact same renderer as the public page
     - character counter with a hard limit
   Press Esc, then Tab, to move keyboard focus out of the box.

   Usage:
     const editor = AVSBioEditor.init({ textarea, preview, counter, toolbar, max });
     editor.refresh();      // call after setting textarea.value from code
     editor.clean(value)    // what should be saved to the database
   Needs assets/store.js (AVSStore.formatRichText) loaded first.
   ========================================================================== */
(function () {
  var INDENT = '    ';

  /* What actually gets saved: unix newlines, no leading blank lines (but the
     first line keeps its indentation), no trailing spaces, no nbsp. */
  function clean(raw) {
    return String(raw == null ? '' : raw)
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+$/gm, '')
      .replace(/^(?:\n)+/, '')
      .replace(/\s+$/, '');
  }

  /* Replace text in a textarea in a way the browser's Undo (Ctrl+Z) still understands. */
  function replaceRange(ta, start, end, text, selStart, selEnd) {
    ta.focus();
    ta.setSelectionRange(start, end);
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      ta.setRangeText(text, start, end, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ta.setSelectionRange(selStart, selEnd);
  }

  /* Start/end offsets of the whole lines touched by the selection. */
  function blockBounds(ta) {
    var v = ta.value;
    var s = ta.selectionStart;
    var e = ta.selectionEnd;
    var start = s === 0 ? 0 : v.lastIndexOf('\n', s - 1) + 1;
    if (e > s && v.charAt(e - 1) === '\n') e -= 1;
    var end = v.indexOf('\n', e);
    if (end === -1) end = v.length;
    return { start: start, end: end };
  }

  function shiftLines(ta, outdent) {
    var b = blockBounds(ta);
    var lines = ta.value.slice(b.start, b.end).split('\n');
    var selS = ta.selectionStart;
    var selE = ta.selectionEnd;
    var firstDelta = 0;
    var totalDelta = 0;
    var out = lines.map(function (ln, i) {
      var nl;
      if (!outdent) {
        nl = lines.length > 1 && ln.trim() === '' ? ln : INDENT + ln;
      } else {
        var m = ln.match(/^(\t| {1,4})/);
        nl = m ? ln.slice(m[0].length) : ln;
      }
      var d = nl.length - ln.length;
      if (i === 0) firstDelta = d;
      totalDelta += d;
      return nl;
    });
    replaceRange(ta, b.start, b.end, out.join('\n'), Math.max(b.start, selS + firstDelta), Math.max(b.start, selE + totalDelta));
  }

  function toggleWrap(ta, m) {
    var v = ta.value;
    var s = ta.selectionStart;
    var e = ta.selectionEnd;
    var n = m.length;
    var sel = v.slice(s, e);
    var bold = m === '**';

    // selection already includes the markers -> remove them
    if (sel.length > 2 * n && sel.slice(0, n) === m && sel.slice(-n) === m &&
        (bold || (sel.charAt(1) !== '*' && sel.charAt(sel.length - 2) !== '*'))) {
      return replaceRange(ta, s, e, sel.slice(n, -n), s, e - 2 * n);
    }
    // markers sit just outside the selection -> remove them
    if (s >= n && v.slice(s - n, s) === m && v.slice(e, e + n) === m &&
        (bold || (v.charAt(s - 2) !== '*' && v.charAt(e + 1) !== '*'))) {
      return replaceRange(ta, s - n, e + n, sel, s - n, e - n);
    }
    if (s === e) return replaceRange(ta, s, e, m + m, s + n, s + n);
    replaceRange(ta, s, e, m + sel + m, s + n, e + n);
  }

  function init(opts) {
    var ta = opts.textarea;
    var preview = opts.preview;
    var counter = opts.counter;
    var toolbar = opts.toolbar;
    var max = opts.max || 2000;
    var tabEscape = false;

    function refresh() {
      var len = clean(ta.value).length;
      if (counter) {
        counter.textContent = len.toLocaleString() + ' / ' + max.toLocaleString();
        counter.classList.toggle('over', len > max);
      }
      if (preview) {
        var html = window.AVSStore ? window.AVSStore.formatRichText(clean(ta.value)) : '';
        preview.innerHTML = html || '<p class="text-muted">Nothing to preview yet. The biography will appear here exactly as visitors will see it.</p>';
      }
    }

    ta.addEventListener('input', refresh);
    ta.addEventListener('blur', function () { tabEscape = false; });

    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Shift' || ev.key === 'Control' || ev.key === 'Alt' || ev.key === 'Meta') return;

      if (ev.key === 'Escape') { tabEscape = true; return; }

      if (ev.key === 'Tab' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        if (tabEscape) { tabEscape = false; return; } // let focus leave the box
        ev.preventDefault();
        var s = ta.selectionStart;
        var e = ta.selectionEnd;
        if (ev.shiftKey) {
          shiftLines(ta, true);
        } else if (ta.value.slice(s, e).indexOf('\n') !== -1) {
          shiftLines(ta, false);
        } else {
          replaceRange(ta, s, e, INDENT, s + INDENT.length, s + INDENT.length);
        }
        return;
      }

      tabEscape = false;

      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey) {
        var k = ev.key.toLowerCase();
        if (k === 'b') { ev.preventDefault(); toggleWrap(ta, '**'); }
        else if (k === 'i') { ev.preventDefault(); toggleWrap(ta, '*'); }
      }
    });

    if (toolbar) {
      // keep the textarea's focus and selection when a button is pressed
      toolbar.addEventListener('mousedown', function (ev) {
        if (ev.target.closest('button')) ev.preventDefault();
      });
      toolbar.addEventListener('click', function (ev) {
        var btn = ev.target.closest('button[data-fmt]');
        if (!btn) return;
        ta.focus();
        var f = btn.getAttribute('data-fmt');
        if (f === 'bold') toggleWrap(ta, '**');
        else if (f === 'italic') toggleWrap(ta, '*');
        else if (f === 'indent') shiftLines(ta, false);
        else if (f === 'outdent') shiftLines(ta, true);
      });
    }

    refresh();
    return { refresh: refresh, clean: clean, max: max };
  }

  window.AVSBioEditor = { init: init, clean: clean };
})();
