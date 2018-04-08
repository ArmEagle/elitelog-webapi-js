/**
 * Defines SocketListener and StateListener classes.
 * Version 1.0, 2018-04-06
 *
 * Usage:
 * var url = "wss://127.0.0.1:8080";
 * var s = new StateListener(url, function(state) { console.log("state change: ", state); });
 * s.run();
 */

/**
 * Listen to websocket on url with set callbacks.
 * @requires https://raw.githubusercontent.com/ArmEagle/userscripts/master/util/formatunicorn.js
 */
class SocketListener {
	/**
	 * @param {string} url Url to connect to. If using a secure websocket,
	 *   the host certificate of course needs to be accepted.
	 * @param {object} callbacks Object with callbacks for events. Event types
	 *   are defined by the key.
	 */
	constructor(url, callbacks) {
		this.url = url;
		this.callbacks = callbacks;

		this.closed_repeat_delay = 10;

		this.initConnection();

	}

	/**
	 * Start websocket with auto reconnect support.
	 * Binds listeners setup in the constructor (including reconnects).
	 */
	initConnection() {
		console.debug("Attempting to connect to {url}...".formatUnicorn({
			"url": this.url,
		}));
		this.socket = new WebSocket(this.url);
		this.addListeners(this.callbacks);

		// Add listener to attempt reconnect after set delay.
		// Makes for an autorepeat because failure will trigger the 'close' event.
		this.addListeners({
			"close": function(event) {
				console.debug("Connection to {url} closed/failed, trying to reconnect in {delay} seconds."
					.formatUnicorn({
						"url": this.url,
						"delay": this.closed_repeat_delay
					})
				);
				window.setTimeout(
					this.initConnection.bind(this),
					this.closed_repeat_delay * 1000
				);
			}.bind(this)
		});
	}

	/**
	 * Add socket listeners.
	 * Manually added callbacks are not readded when the socket is closed and manages to reconnect.
	 * @param {object} callbacks, key is event type.
	 */
	addListeners(callbacks) {
		if (typeof callbacks === "undefined") {
			console.error("SocketListener:addListener() no callbacks passed")
			return;
		}
		for (var prop in callbacks) {
			var callback = callbacks[prop];
			this.socket.addEventListener(prop, function(event) {
				callback(event);
			});
		}
	}

	close() {
		if (this.socket) {
			this.socket.close();
		}
	}
}

/**
 * Class that connects to WebSocket and awaits state change messages.
 * @param: url: string A complete websocket url.
 * @param: stateChangeCallback: a callback which will be passed the state object when state changes.
 *   "closed" is passed when the connection is closed. On initial connect a state will be passed.
 */
class StateListener {

	constructor(url, stateChangeCallback) {
		this.url = url;
		this.stateChangeCallback = stateChangeCallback
		this.state = {};
	}

	run() {
		this.s = new SocketListener(
			this.url, {
				"open": function(event) {this.genericEventListener("open", event);}.bind(this),
				"close": function(event) {this.genericEventListener("close", event);}.bind(this),
				"message": function(event) {this.genericEventListener("message", event);}.bind(this),
			}
		);
	}

	genericEventListener(type, event) {
//		 console.debug("logging generic event:", type, event);
		if (type === "message" && event.type === "message") {
			var json = JSON.parse(event.data)
			switch (json.event) {
				case "state":
					this.handleStateUpdate(json.data)
					break;
			}
		} else if (type === "close") {
			handleStateUpdate("closed");
		}
	}

	handleStateUpdate(state) {
		this.state = state;

		if (typeof this.stateChangeCallback !== "undefined") {
			this.stateChangeCallback(state);
		} else {
			console.info ("No State change callback is defined. State update:", state);
		}
	}
}