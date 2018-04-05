'use strict';

const wrap = document.querySelector('.wrap');
wrap.querySelector('.current-image').src = '';
const menu = wrap.querySelector('.menu');
const burger = menu.querySelector('.burger');
const comments = menu.querySelector('.comments');
const draw = menu.querySelector('.draw');
const share = menu.querySelector('.share');
const modeHTMLElements = Array.from( menu.querySelectorAll('.mode') );
let picID;
let shownComments = {};


// преобразование timestamp в строку необходимого формата для отображения времени
function getDate(timestamp) {
    const options = {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    };
  
    const date = new Date(timestamp);
    const dateStr = date.toLocaleString(options);
    return dateStr.slice(0, 6) + dateStr.slice(8, 10) + dateStr.slice(11);
}

// dragability
let movedPiece = null;
let shiftX = 0;
let shiftY = 0;
const minX = wrap.offsetLeft;
const minY = wrap.offsetTop;
let maxX;
let maxY;

document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', throttle(drag));
document.addEventListener('mouseup', drop);

function dragStart(event) {
    if (event.target.classList.contains('drag')) {
        movedPiece = menu;

        const bounds = movedPiece.getBoundingClientRect();
        
        shiftX = event.pageX - bounds.left - window.pageXOffset;
        shiftY = event.pageY - bounds.top - window.pageYOffset;

        maxX = minX + wrap.offsetWidth - movedPiece.offsetWidth;
        maxY = minY + wrap.offsetHeight - movedPiece.offsetHeight;
    }
}

function drag(event) {
    if (movedPiece) {
        event.preventDefault();

        let x = event.pageX - shiftX;
        let y = event.pageY - shiftY;

        x = Math.min(x, maxX - 1);
        y = Math.min(y, maxY);

        x = Math.max(x, minX);
        y = Math.max(y, minY);

        movedPiece.style.left = `${x}px`;
        movedPiece.style.top = `${y}px`;
    }
}

function drop() {
    if (movedPiece) {
        movedPiece = null;
    }
}

function throttle(callback) {
    let isWaiting = false;
    return function (...rest) {
        if (!isWaiting) {
            callback.apply(this, rest);
            isWaiting = true;
            requestAnimationFrame(() => {
                isWaiting = false;
            });
        }
    };
}

// ~~~~~~~~~~~~~~~~~~~~ Показывать/не покаазывать комментарии ~~~~~~~~~~~~~~~~~~~
wrap.querySelector('#comments-on').addEventListener('change', checkCommentsShow);
wrap.querySelector('#comments-off').addEventListener('change', checkCommentsShow);

function checkCommentsShow() {
    if (wrap.querySelector('#comments-on').checked) {
        Array.from(wrap.querySelectorAll('.comments__form')).forEach(form => {
            form.style.display = '';
        });
        // console.log('comments on');
    } else {
        Array.from(wrap.querySelectorAll('.comments__form')).forEach(form => {
            form.style.display = 'none';
        });
        // console.log('comments off');
    }
}

// ~~~~~~~~~~~~~~Состояние "Публикация" (по умолчанию)~~~~~~~~~~~~~~~

wrap.dataset.state = '';
menu.dataset.state = 'initial';

menu.style.top = ( (document.documentElement.clientHeight - menu.offsetHeight) / 2) + 'px';
menu.style.left = ( (document.documentElement.clientWidth - menu.offsetWidth) / 2) + 'px';

    // выбор файла изображения
const fileInput = document.createElement('input');
fileInput.setAttribute('type', 'file');
fileInput.setAttribute('accept', 'image/jpeg, image/png');
fileInput.style.cssText = `
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    opacity: 0;
`;
fileInput.addEventListener('change', event => {
    const file = event.currentTarget.files[0];
    publishImage(file);
});
menu.querySelector('.new').insertBefore(fileInput, menu.querySelector('.new').firstElementChild);

wrap.addEventListener('drop', event => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    publishImage(file);
});
wrap.addEventListener('dragover', event => event.preventDefault());


// отправка картинки на сервер и получение данных от сервера
function publishImage(file) {
    const formData = new FormData();
    formData.append('title', file.name);
    formData.append('image', file);

    wrap.querySelector('.error').style.display = 'none';
    menu.style.display = 'none';
    wrap.querySelector('.image-loader').style.display = '';

    Promise.resolve(file.type)
    .then(fileType => {
        const imageTypeRegExp = /^image\/png|^image\/jpeg/;
        if (!imageTypeRegExp.test(fileType)) {
            throw 'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.';
        }
    })
    .then(() => fetch('https://neto-api.herokuapp.com/pic', {
        body: formData,
        credentials: 'same-origin',
        method: 'POST',
        // headers: {
        //     'Content-Type': 'multipart/form-data'
        // }
        // почему если прописать заголовок 'Content-Type': 'multipart/form-data' приходит ошибка?
    }))
    .then(res => {
        Array.from(wrap.querySelectorAll('form.comments__form')).forEach(form => form.remove());
        menu.style.display = '';
        wrap.querySelector('.image-loader').style.display = 'none';
        if (res.status >= 400) throw res.statusText;
        return res.json();
    })

    .then(res => {
        picID = res.id;
        return fetch(`https://neto-api.herokuapp.com/pic/${res.id}`);
    })

    .then(res => {
        if (res.status >= 400) throw res.statusText;
        return res.json();
    })

    .then(res => {
        // переключаем режим
        menu.dataset.state = 'selected';
        modeHTMLElements.forEach(elem => elem.dataset.state = '');
        share.dataset.state = 'selected';

        // не понимаю, какую ссылку вставлять сюда.. (
        menu.querySelector('input.menu__url').value = `${window.location.href}/https://neto-api.herokuapp.com/pic/${res.id}?`;
        wrap.querySelector('.current-image').src = res.url;
        
        // отрисовываем полученные комментарии
        updateComments(res.comments);

        // создаем соединение вэбсокет
        const ws = new WebSocket(`wss://neto-api.herokuapp.com/pic/${res.id}`);
        ws.addEventListener('open', () => {
            // console.log('web socket is open');
        });
        ws.addEventListener('message', event => {
            console.log(`пришло сообщение через вэбсокет:\n${event.data}`);
            const wsData = JSON.parse(event.data);
            if (wsData.event === 'comment') {
                insertWSComment(wsData.comment);
            }
        });
        ws.addEventListener('error', error => {
            console.log('ошибка вэбсокета');
            throw error;
        });
    })
    .catch(err => {
        menu.style.display = 'none';
        wrap.querySelector('.image-loader').style.display = 'none';
        wrap.querySelector('.error__message').textContent = err;
        wrap.querySelector('.error').style.display = '';
        console.log(err);
    });
}

// ~~~~~~~~ переключение режимов (вид меню) ~~~~~~~~~

burger.addEventListener('click', () => {
    menu.dataset.state = 'default';
    modeHTMLElements.forEach(elem => elem.dataset.state = '');
});

modeHTMLElements.forEach(elem => {
    if (!elem.classList.contains('new')) {
        elem.addEventListener('click', (event) => {
            menu.dataset.state = 'selected';
            event.currentTarget.dataset.state = 'selected';
        });
    }
});

// копирование в буфер обмена

menu.querySelector('input.menu_copy').addEventListener('click', () => {
    menu.querySelector('input.menu__url').select();
    document.execCommand('copy');
});

// ~~~~~~~~~~~~~~режим "Комментирование"~~~~~~~~~~~~~~~

function createBlankForm() {
    const newForm = document.createElement('form');
    newForm.classList.add('comments__form');
    newForm.innerHTML = `
        <span class="comments__marker"></span><input type="checkbox" class="comments__marker-checkbox">
        <div class="comments__body">
            <div class="comment" style="display: none;">
                <div class="loader">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>            
            </div>          
            <textarea class="comments__input" type="text" placeholder="Напишите ответ..."></textarea>
            <input class="comments__close" type="button" value="Закрыть">
            <input class="comments__submit" type="submit" value="Отправить">
        </div>
    `;
    return newForm;
}

// создание нового комментария на холсте
wrap.querySelector('.current-image').addEventListener('click', (event) => {
    // проверяем, что включен режим "Комментирование" и стоит галочка "Показывать комментарии"
    if (comments.dataset.state !== 'selected' || !wrap.querySelector('#comments-on').checked) return;

    const newComment = createBlankForm();
    newComment.querySelector('.comments__marker-checkbox').checked = true;
    wrap.appendChild(newComment);

    // смещаем координаты формы так, чтобы стрелка маркера указывала ровно на точку, куда мы кликнули
    const marker = newComment.querySelector('.comments__marker');
    const coordX = event.pageX - getComputedStyle(marker).left.slice(0, -2) - (+getComputedStyle(marker).width.slice(0, -2)) / 2;
    const coordY = event.pageY - getComputedStyle(marker).top.slice(0, -2) - getComputedStyle(marker).height.slice(0, -2);
    newComment.style.cssText = `
        top: ${coordY}px;
        left: ${coordX}px;
    `;

    // в каждую форму добавляем атрибуты data-left и data-top (координаты левого верхнего угла формы относительно current-image)
    newComment.dataset.left = newComment.getBoundingClientRect().left - wrap.querySelector('.current-image').getBoundingClientRect().left;
    newComment.dataset.top = newComment.getBoundingClientRect().top - wrap.querySelector('.current-image').getBoundingClientRect().top;

    // кнопка "Закрыть"
    newComment.querySelector('.comments__close').addEventListener('click', () => {
        newComment.querySelector('.comments__marker-checkbox').checked = false;
    });

    // кнопка "Отправить"
    newComment.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = newComment.querySelector('.comments__input').value;
        // const left = newComment.getBoundingClientRect().left - wrap.querySelector('.current-image').getBoundingClientRect().left;
        // const top = newComment.getBoundingClientRect().top - wrap.querySelector('.current-image').getBoundingClientRect().top;
        const body = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(newComment.dataset.left)}&top=${encodeURIComponent(newComment.dataset.top)}`;
        newComment.querySelector('.loader').parentElement.style.display = '';

        fetch(`https://neto-api.herokuapp.com/pic/${picID}/comments`, {
            body: body,
            credentials: 'same-origin',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        .then(res => {
            if (res.status >= 400) throw res.statusText;
            return res.json();
        })
        .then(res => {
            // console.log(res);
            updateComments(res.comments);
            newComment.querySelector('.comments__input').value = '';
        })
        .catch(err => {
            console.log(err);
            newComment.querySelector('.loader').parentElement.style.display = 'none';
        });
    });
});


// отрисовка комментариев, пришедших с сервера

function updateComments(newComments) {
    if (!newComments) return;
    Object.keys(newComments).forEach(id => {

        // если сообщение с таким id уже есть в shownComments (отрисованный комментарии), ничего не делаем
        if (id in shownComments) return;
        
        shownComments[id] = newComments[id];
        let needCreateNewForm = true;
        Array.from(wrap.querySelectorAll('.comments__form')).forEach(form => {
            // если уже существует форма с заданными координатами left и top, добавляем сообщение в эту форму
            if (+form.dataset.left === shownComments[id].left && +form.dataset.top === shownComments[id].top) {
                form.querySelector('.loader').parentElement.style.display = 'none';

                // добавляем в эту форму сообщение
                addMsgToForm(newComments[id], form);
                needCreateNewForm = false;
            }
        });

        // если формы с заданными координатами пока нет на холсте, создаем эту форму и добавляем в нее сообщение
        if (needCreateNewForm) {
            const newForm = createBlankForm();
            newForm.dataset.left = newComments[id].left;
            newForm.dataset.top = newComments[id].top;
            
            const coordX = newComments[id].left + wrap.querySelector('.current-image').getBoundingClientRect().left + window.pageXOffset;
            const coordY = newComments[id].top + wrap.querySelector('.current-image').getBoundingClientRect().top + window.pageYOffset;
            newForm.style.cssText = `
                top: ${coordY}px;
                left: ${coordX}px;
            `;
            addMsgToForm(newComments[id], newForm);
            wrap.appendChild(newForm);

            if (!wrap.querySelector('#comments-on').checked) {
                newForm.style.display = 'none';
            }
        }
    });
}

// добавляем новое сообщение в форму, так чтобы все сообщения внутри формы шли по порядку возрастания data-timestamp
function addMsgToForm(newMsg, form) {
    let timestamp = 9999999999999;
    let theNearestLowerDiv = form.querySelector('.loader').parentElement;

    Array.from(form.querySelectorAll('[data-timestamp]')).forEach(msgDiv => {
        if (+msgDiv.dataset.timestamp < newMsg.timestamp) return;
        if (+msgDiv.dataset.timestamp < timestamp) {
            timestamp = +msgDiv.dataset.timestamp;
            theNearestLowerDiv = msgDiv;
        }
    });

    const newMsgDiv = document.createElement('div');
    newMsgDiv.classList.add('comment');
    newMsgDiv.dataset.timestamp = newMsg.timestamp;
    
    const pCommentTime = document.createElement('p');
    pCommentTime.classList.add('comment__time');
    pCommentTime.textContent = getDate(newMsg.timestamp);
    newMsgDiv.appendChild(pCommentTime);

    const pCommentMessage = document.createElement('p');
    pCommentMessage.classList.add('comment__message');
    pCommentMessage.textContent = newMsg.message;
    newMsgDiv.appendChild(pCommentMessage);

    form.querySelector('.comments__body').insertBefore(newMsgDiv, theNearestLowerDiv);
}

// обработка комментария от вэбсокета
function insertWSComment(wsComment) {
    const wsCommentEdited = {};
    wsCommentEdited[wsComment.id] = {};
    wsCommentEdited[wsComment.id].left = wsComment.left;
    wsCommentEdited[wsComment.id].message = wsComment.message;
    wsCommentEdited[wsComment.id].timestamp = wsComment.timestamp;
    wsCommentEdited[wsComment.id].top = wsComment.top;

    updateComments(wsCommentEdited);
}


// для тестирования updateComments
// const testComments = {
//     '-L9K4123': {
//         left: 363,
//         message: 'Привет01',
//         timestamp: 1522919707362,
//         top: 165
//     },
//     '-L9K4124': {
//         left: 363,
//         message: 'Привет02',
//         timestamp: 1622919707362,
//         top: 165
//     },
//     '-L9K4125': {
//         left: 463,
//         message: 'Привет03',
//         timestamp: 1622919707362,
//         top: 265
//     }

// };
// console.log(testComments);

