'use strict';
function FireChat() {
	this.googleAuth = document.getElementById('google_auth');
	this.logout = document.getElementById('logout');
	this.messageList = document.getElementById('messages');
	this.messageInput = document.getElementById('message');
	this.submitButton = document.getElementById('send');
	this.messageForm = document.getElementById('form');
	this.submitImageButton = document.getElementById('image');
  	this.mediaCapture = document.getElementById('capture');

	// Eventos para manejar la autenticacion
	this.googleAuth.addEventListener('click', this.signIn.bind(this));
	this.logout.addEventListener('click', this.signOut.bind(this));

	this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
	this.submitImageButton.addEventListener('click', function(e) {
    	e.preventDefault();
    	this.mediaCapture.click();
  	}.bind(this));
  	this.mediaCapture.addEventListener('change', this.saveImageMessage.bind(this));
	this.initFirebase();
};

FireChat.prototype.initFirebase = function() {
	// Atajos para el SDK de Firebase
	this.auth = firebase.auth();
	this.database = firebase.database();
	this.storage = firebase.storage();
	// Inicializa la autenticacion de Firebase y escucha los cambios de estado
	this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

FireChat.prototype.signIn = function() {
	var provider =  new firebase.auth.GoogleAuthProvider();
	this.auth.signInWithPopup(provider);
};

FireChat.prototype.signOut = function() {
	this.auth.signOut();
	location.reload();
};

FireChat.prototype.onAuthStateChanged = function(user) {
	if(user) {
		document.getElementById('messages').innerHTML = '';
		var photo = user.photoURL;
		var userName = user.displayName;
		var email = user.email;
		this.googleAuth.classList.add('hide');
		this.logout.classList.remove('hide');
		var avatar = document.getElementById('avatar');
		var img = document.createElement('img');
		img.setAttribute('src', photo);
		img.setAttribute('class', 'img-circle img-responsive img-profile');
		avatar.append(img);
		var details = document.getElementById('details');
		details.innerHTML = FireChat.DETAILS_TEMPLATE;
		details.querySelector('#name').textContent = userName;
		details.querySelector('#email').textContent = email;
		this.loadMessages();
		this.saveMessagingDeviceToken();
	} else {
		setTimeout(function() {
            $('#demo_sent').removeClass('hide');
          }, 2000);
          setTimeout(function() {
            $('#demo_receive').removeClass('hide');
          }, 3500);
		this.logout.classList.add('hide');
		this.googleAuth.classList.remove('hide');
	}
};

FireChat.prototype.checkSignedInWithMessage = function() {
	if (this.auth.currentUser) {
		return true;
	}
	$(function(){
        new PNotify({
            title: 'Primero debes iniciar sesion',
            type: 'error'
        });
    });
    this.messageInput.value = "";
	
	return false;
};

FireChat.prototype.loadMessages = function() {
	this.messagesRef = this.database.ref('messages');
	this.messagesRef.off();

	var setMessage = function(data) {
		var val = data.val();
		this.displayMessage(data.key, val.name, val.text, val.photoUrl, val.imageUrl, val.uid, val.sent);
	}.bind(this);
	this.messagesRef.limitToLast(10).on('child_added', setMessage);
	this.messagesRef.limitToLast(10).on('child_changed', setMessage);
};

FireChat.prototype.displayMessage = function(key, name, text, picUrl, imageUri, uid, sent) {
	var div = document.getElementById(key);
	var imageSource = '';

	if(!div) {
		var container = document.createElement('div');
		if(this.auth.currentUser.uid === uid) {
			imageSource = '/assets/images/blue-user-icon.png';
			container.innerHTML = FireChat.MESSAGE_SENT_TEMPLATE;
		} else {
			imageSource = '/assets/images/green-user-icon.png';
			container.innerHTML = FireChat.MESSAGE_RECEIVED_TEMPLATE;
		}
		div = container.firstChild;
		div.setAttribute('id', key);
		this.messageList.appendChild(div);
	}
	if(picUrl) {
		imageSource = picUrl;
	} 
	div.querySelector('img').setAttribute('src', imageSource);
	div.querySelector('time').textContent = moment(sent).fromNow();
	var messageElement = div.querySelector('.message');
	if(this.auth.currentUser.uid !== uid) {
		div.querySelector('.name').textContent = name + ':';
	}
	if (text) {
		messageElement.textContent = text;
		messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
	} else if(imageUri) {
		var link = document.createElement('a');
		var image = document.createElement('img');
		image.classList.add('attachments');
		image.addEventListener('load', function() {
			this.messageList.scrollTop = this.messageList.scrollHeight;
		}.bind(this));
		this.setImageUrl(imageUri, image);
		this.createImageLink(imageUri, link);
		link.setAttribute('target', '_blank');
		messageElement.innerHTML = '';
		link.appendChild(image);
		messageElement.appendChild(link);
	}
	this.messageList.scrollTop = this.messageList.scrollHeight;
	this.messageInput.focus();
};

FireChat.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

FireChat.DETAILS_TEMPLATE = 
	'<p><strong>Nombre:</strong> <span id="name"></p>' +
    '<p><strong>E-mail:</strong> <span id="email"></p>';

FireChat.MESSAGE_SENT_TEMPLATE =
	'<div class="row msg_container base_sent">' +
        '<div class="col-md-1 col-xs-1"></div>' +
        '<div class="col-md-10 col-xs-10">' +
            '<div class="messages msg_sent">' +
               	'<p class="message"></p>' +
                '<time></time>' +
            '</div>' +
        '</div>' +
        '<div class="col-md-1 col-xs-1 user">' +
            '<img class="img-circle img-responsive sent">' +
        '</div>' +
    '</div>';

FireChat.MESSAGE_RECEIVED_TEMPLATE =
	'<div class="row msg_container base_receive">' +
        '<div class="col-md-2 col-xs-2 user">' +
            '<img class="img-circle img-responsive sent">' +
        '</div>' +
        '<div class="col-md-10 col-xs-10">' +
            '<div class="messages msg_receive">' +
            	'<p class="name"></p>' +
               	'<p class="message"></p>' +
                '<time></time>' +
            '</div>' +
        '</div>' +
    '</div>';

FireChat.prototype.saveMessage = function(e) {
	e.preventDefault();
	if(this.messageInput.value && this.checkSignedInWithMessage()) {
		var currentUser = this.auth.currentUser;
		var textMessage = this.messageInput.value;
		this.messageInput.value = '';
		this.messagesRef.push({
			name: currentUser.displayName,
			text: textMessage,
			photoUrl: currentUser.photoURL || '/assets/images/blue-user-icon.png',
			uid: currentUser.uid,
			sent: (new Date).getTime()
		})
		.then(function() {
			this.messageInput.value = '';
		}.bind(this))
		.catch(function(error) {
			console.error('Error al escribir el nuevo mensaje en la base de datos', error);
		});
	}
};

FireChat.prototype.saveImageMessage = function(e) {
	e.preventDefault();
	var file = event.target.files[0];
	this.messageForm.reset();
	if(!file.type.match('image.*')) {
		var data = {
			message: 'Solo puedes compartir imagenes',
			timeout: 2000
		};
		$(function(){
        	new PNotify({
            	title: 'Solo puedes compartir imagenes',
            	type: 'error'
        	});
    	});
		return;
	}

	if(this.checkSignedInWithMessage()){
		var currentUser = this.auth.currentUser;
		this.messagesRef.push({
			name: currentUser.displayName,
			imageUrl: FireChat.LOADING_IMAGE_URL,
			photoUrl: currentUser.photoURL || '/assets/images/blue-user-icon.png',
			uid: currentUser.uid,
			sent: (new Date).getTime()
		})
		.then(function(data) {
			var filePath = currentUser.uid + '/' + data.key + '/' + file.name;
			return this.storage.ref(filePath).put(file).then(function(snapshot) {
				var fullPath = snapshot.metadata.fullPath;
				return data.update({ imageUrl: this.storage.ref(fullPath).toString() });
			}.bind(this));
			}.bind(this))
		.catch(function(error) {
			console.log('Ocurrio un error al subir el archivo: ', error);
		});
	}
}

FireChat.prototype.setImageUrl = function(imageUri, imgElement) {
	if(imageUri.startsWith('gs://')) {
		imgElement.src = FireChat.LOADING_IMAGE_URL;
		this.storage.refFromURL(imageUri).getMetadata().then(function(metadata) {
			imgElement.src = metadata.downloadURLs[0];
		});
	} else {
		imgElement.src = imageUri;
	}
};

FireChat.prototype.createImageLink = function(imageUri, linkElement) {
	if(imageUri.startsWith('gs://')) {
		this.storage.refFromURL(imageUri).getMetadata().then(function(metadata) {
			linkElement.setAttribute('href', metadata.downloadURLs[0]);
		});
	} else {
		linkElement.setAttribute('href', '#');
	}
};

FireChat.prototype.saveMessagingDeviceToken = function() {
	firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
     	firebase.database().ref('/fcmTokens').child(currentToken)
     		.set(firebase.auth().currentUser.uid);
    } else {
      this.requestNotificationsPermissions();
    }
  }.bind(this)).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
};

FireChat.prototype.requestNotificationsPermissions = function() {
	firebase.messaging().requestPermission().then(function() {
		this.saveMessagingDeviceToken();
	}.bind(this)).catch(function(error) {
		console.log('No se pudo obtener el permiso de notificaciones', error);
	});
};

window.onload = function() {
	window.fireChat = new FireChat();
};