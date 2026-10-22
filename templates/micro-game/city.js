// =====================================================================
//  city.js : talking to Vibe City
//
//  A mod page runs in a sealed frame. It cannot see the game, it can only
//  send messages and listen for them. This file wraps them in a few calls
//  so game.js reads plainly. Copy it into your own game as it is.
//
//    CITY.ready(fn)      fn(info) when the city answers: info.city, info.data, info.money, info.volume
//    CITY.save(data)     keep any JSON with the city's save (32 KB at most)
//    CITY.pay(dollars)   put money in the city's funds (up to money.per_month in mod.json)
//    CITY.toast(text)    a line at the bottom of the game's screen
//    CITY.close()        close this window
//    CITY.onPaid(fn)     fn(amount, left) after a payment went through
//
//  Opened outside the game (straight in a browser, while you build it),
//  nobody answers, so after a moment it pretends to be a small test city.
// =====================================================================

const CITY = (() => {
  const inGame = parent !== window;
  const send = m => { if (inGame) parent.postMessage(m, "*"); };
  let onReady = null, onPaid = () => {}, answered = false;

  addEventListener("message", e => {
    const d = e.data || {};
    if (d.vc === "init") {
      answered = true;
      onReady && onReady({ city: d.city, data: d.data, money: d.money, volume: d.settings ? d.settings.volume ?? 1 : 1 });
    }
    if (d.vc === "paid") onPaid(d.amount, d.left);
  });

  return {
    inGame,
    ready(fn) {
      onReady = fn; send({ vc: "ready" });
      // a browser tab on its own: a pretend city, so the game still runs
      setTimeout(() => { if (!answered) fn({ city: { open: true, name: "Test City", year: 1990, pop: 1000 }, data: null, money: { perMonth: 1200, left: 1200 }, volume: .6 }); }, 400);
    },
    save:  data => send({ vc: "save", data }),
    pay:   amount => { send({ vc: "pay", amount: Math.floor(amount) }); if (!inGame) setTimeout(() => onPaid(Math.floor(amount), 0), 50); },
    toast: text => send({ vc: "toast", text }),
    close: () => send({ vc: "close" }),
    onPaid: fn => { onPaid = fn; },
  };
})();
