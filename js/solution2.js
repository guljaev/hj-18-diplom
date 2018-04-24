'use strict';

const wrap = document.querySelector('.wrap');
const currentImage = document.querySelector('.current-image');

// элементы меню
const menu = document.querySelector('.menu');
const burger = document.querySelector('.burger');
const comments = document.querySelector('.comments');
const draw = document.querySelector('.draw');
const share = document.querySelector('.share');
const menuUrl = document.querySelector('.menu__url');
const modeHTMLElements = Array.from( document.querySelectorAll('.mode') );

// предупреждения и ошибки
const imageLoader = document.querySelector('.image-loader');
const errorMessage = document.querySelector('.error__message');
const errorNode = document.querySelector('.error');

// переключатели отображения комментариев
const commentsOnInput = document.querySelector('#comments-on');
const commentsOffInput = document.querySelector('#comments-off');

// ID картинки
let picID;

// база отображенных комментариев
const shownComments = {};

// ссылка на WebSocket
let wsGlobal = null;

// контейнер, в который помещаются комментарии, холст и рисунки пользователей
let commentsWrap;
const canvas = document.createElement('canvas');
let userStrokesImgElement;

// ~~~ Преобразование timestamp в строку необходимого формата для отображения времени ~~~
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

// ~~~~~~~~~~~~~~ Перетаскивание меню ~~~~~~~~~~~~~~~~~

// начальное положению меню
menu.style.top = '30px';
menu.style.left = '30px';

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

// вычисляем сдвиг указателя относительно левого верхнего края меню
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

// перемещаем меню в соответствии с движением мыши, учитываем ограничения
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

// заканчиваем движение меню
function drop() {
    if (movedPiece) {
        movedPiece = null;
    }
}

// используется для ограничения частоты срабатывания функции drag
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

// ~~~~~~~~~~~~~ Сдвигание меню, если ему не хватает длины ~~~~~~~~~~~~

// если меню "скукоживается" (не хватает длины), смещаем его по горизонатали, чтобы оно встало рядом с правым краем изображения
function checkMenuRumple() {
    if (menu.offsetHeight > 100) {
        console.log('rumple');
        menu.style.left = '0px';
        menu.style.left = (wrap.offsetWidth - menu.offsetWidth - 1) + 'px';
    }
}

// проверяем корректность отображения меню при каждой перерисовке страницы
function checkMenuRumpleTick() {
    checkMenuRumple();
    window.requestAnimationFrame(checkMenuRumpleTick);
}
checkMenuRumpleTick();


// ~~~~~~~~~~~~~~~~~~~~ Показывать/не показывать комментарии ~~~~~~~~~~~~~~~~~~~
commentsOnInput.addEventListener('change', checkCommentsShow);
commentsOffInput.addEventListener('change', checkCommentsShow);

function checkCommentsShow() {
    if (commentsOnInput.checked) {
        Array.from(document.querySelectorAll('.comments__form')).forEach(form => {
            form.style.display = ''; //comments on
        });
    } else {
        Array.from(document.querySelectorAll('.comments__form')).forEach(form => {
            form.style.display = 'none'; //comments off
        });
    }
}

// ~~~~~~~~ Переключение режимов (вид меню) ~~~~~~~~~

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

// ~~~~ Копирование в буфер обмена из режима "Поделиться" ~~~~

document.querySelector('.menu_copy').addEventListener('click', () => {
    menuUrl.select();
    document.execCommand('copy');
});


// ~~~~~~~~~~~~~~ Отправка запроса на сервер ~~~~~~~~~~~~~~~

// при наличии id внутри ссылки сразу делаем GET-запрос
const regexp = /id=([^&]+)/i;
if (regexp.exec(document.location.search)) {
    picID = regexp.exec(document.location.search)[1];

    menu.style.display = 'none';
    imageLoader.style.display = '';

    fetch(`https://neto-api.herokuapp.com/pic/${picID}`)
    .then(res => {
        if (res.status >= 400) throw res.statusText;
        menu.style.display = '';
        imageLoader.style.display = 'none';
        return res.json();
    })

    .then(res => {
        treatAjaxServerAnswer(res);
        // переходим в режим "Комментирование"
        modeHTMLElements.forEach(elem => elem.dataset.state = '');
        comments.dataset.state = 'selected';
    })
    .catch(err => {
        menu.style.display = 'none';
        imageLoader.style.display = 'none';
        errorMessage.textContent = err;
        errorNode.style.display = '';
        console.log(err);
    });  
}

// обработка ответа, пришедшего от сервера по Ajax
function treatAjaxServerAnswer(res) {
    // переключаем режим меню
    menu.dataset.state = 'selected';
    modeHTMLElements.forEach(elem => elem.dataset.state = '');
    share.dataset.state = 'selected';

    // формируем адрес ссылки
    const url = document.location.href.split('?')[0] + `?id=${res.id}`;
    menuUrl.value = url;
    
    // после загрузки картинки..
    currentImage.addEventListener('load', () => {
        // создаем div по размерам картинки, чтобы вкладывать в него комментарии, canvas и img для отрисовки данных от сервера
        createCommentsWrap();

        // создаем canvas для собственного рисования и img для отрисовки данных от сервера
        createCanvas();
        createUserStrokesImgElement();
        
        // отрисовываем полученные комментарии и штрихи пользователей
        updateComments(res.comments);
        drawUsersStrokes(res.mask);
    });
    currentImage.src = res.url;
    
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
        if (wsData.event === 'mask') {
            drawUsersStrokes(wsData.url);
        }
    });
    ws.addEventListener('error', error => {
        console.log('ошибка вэбсокета');
    });
    wsGlobal = ws;
}

// Возможность загрузки файла изображения
const fileInput = document.createElement('input');
fileInput.setAttribute('type', 'file');
fileInput.setAttribute('accept', 'image/jpeg, image/png');
fileInput.classList.add('menu__fileloader');

fileInput.addEventListener('change', event => {
    const file = event.currentTarget.files[0];
    publishImage(file);
});
document.querySelector('.new').insertBefore(fileInput, document.querySelector('.new').firstElementChild);

wrap.addEventListener('drop', event => {
    event.preventDefault();
    if (picID) {
        errorMessage.textContent = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню.';
        errorNode.style.display = '';
        return;
    }
    const file = event.dataTransfer.files[0];
    publishImage(file);
});
wrap.addEventListener('dragover', event => event.preventDefault());


// отправка файла картинки на сервер и получение данных от сервера
function publishImage(file) {
    if (!file) return;

    // проверяем тип файла
    function fileTypeIsIncorrect(fileType) {
        let isIncorrect = false;
        fileType.split('/').forEach(type => {
            if ( !(type === 'image' || type === 'png' || type === 'jpeg') ) {
                isIncorrect = true;
            }
        }); 
        return isIncorrect;   
    }

    if (fileTypeIsIncorrect(file.type)) {
        errorMessage.textContent = 'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.';
        errorNode.style.display = '';
        return;
    }
    
    const formData = new FormData();
    formData.append('title', file.name);
    formData.append('image', file);

    errorNode.style.display = 'none';
    menu.style.display = 'none';
    imageLoader.style.display = '';

    fetch('https://neto-api.herokuapp.com/pic', {
        body: formData,
        credentials: 'same-origin',
        method: 'POST',
    })
    .then(res => {
        // стираем комментарии, которые могли остаться от предыдущей картинки
        Array.from(document.querySelectorAll('.comments__form')).forEach(form => form.remove());
        // стираем следы рисования от предыдущей картинки
        if (userStrokesImgElement) userStrokesImgElement.src = './pic/transparent.png';

        menu.style.display = '';
        imageLoader.style.display = 'none';
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
        treatAjaxServerAnswer(res);
    })
    .catch(err => {
        menu.style.display = 'none';
        imageLoader.style.display = 'none';
        errorMessage.textContent = err;
        errorNode.style.display = '';
        console.log(err);
    });
}


// ~~~~~~~~~~~~~~ Комментирование ~~~~~~~~~~~~~~~

// создаем div, в который будем помещать комментарии (нужно, чтобы координаты комментариев можно было зафиксировать относительно этого div, а не документа, чтобы комментарии не съезжали при изменении окна браузера)
function createCommentsWrap() {
    if (!commentsWrap) {
        commentsWrap = document.createElement('div');
    }

    const width = getComputedStyle(currentImage).width;
    const height = getComputedStyle(currentImage).height;

    commentsWrap.style.width = width;
    commentsWrap.style.height = height;
    commentsWrap.classList.add('comments-wrap');
    wrap.appendChild(commentsWrap);

    commentsWrap.addEventListener('click', event => {
        if (event.target.closest('.comments__form')) {
            const currentForm = event.target.closest('.comments__form');
            // отображаем интересующие комментарии (по клику) поверх остальных
            Array.from(document.querySelectorAll('.comments__form')).forEach(form => {
                form.style.zIndex = 10;
            });
            currentForm.style.zIndex = 11;

            // удаляем все пустые комментарии, помимо того, на который кликнули
            deleteAllBlankCommentFormsExcept(currentForm);

            // сворачиваем все комментарии кроме текущего
            minimizeAllCommentFormsExcept(currentForm);
        }
    });
}

// Создаем новый элемент form для комментариев
function createBlankForm() {
    const newForm = document.querySelector('.comments__form__sample').cloneNode(true);
    newForm.classList.remove('comments__form__sample');
    newForm.classList.add('comments__form');
    newForm.style.display = '';
    newForm.style.zIndex = 10;

    // кнопка "Закрыть"
    newForm.querySelector('.comments__close').addEventListener('click', () => {
        // если есть комментарии (помимо loader), то просто сворачиваем
        if (newForm.querySelectorAll('.comment').length > 1) {
            newForm.querySelector('.comments__marker-checkbox').checked = false;
        } else {
            // если комментариев нет, удалаем форму
            newForm.remove();
        }
    });

    // кнопка "Отправить"
    newForm.addEventListener('submit', event => {
        event.preventDefault();
        const message = newForm.querySelector('.comments__input').value;
        const body = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(newForm.dataset.left)}&top=${encodeURIComponent(newForm.dataset.top)}`;
        newForm.querySelector('.loader').parentElement.style.display = '';

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
            updateComments(res.comments);
            newForm.querySelector('.comments__input').value = '';
        })
        .catch(err => {
            console.log(err);
            newForm.querySelector('.loader').parentElement.style.display = 'none';
        });
    });

    return newForm;
}

// удаляем все пустые комментарии, кроме currentForm
function deleteAllBlankCommentFormsExcept(currentForm = null) {
    Array.from(document.querySelectorAll('.comments__form')).forEach(form => {
        if (form.querySelectorAll('.comment').length < 2 && form !== currentForm) {
            // если комментариев нет, и выбран не текущий комментарий, удалаем форму
            form.remove();
        }
    });
}

// сворачиваем все пустые комментарии, кроме currentForm
function minimizeAllCommentFormsExcept(currentForm = null) {
    Array.from(document.querySelectorAll('.comments__form')).forEach(form => {
        if (form !== currentForm) {
            // если выбран не текущий комментарий, сворачиваем его
            form.querySelector('.comments__marker-checkbox').checked = false;
        }
    });
}

// создание нового комментария на холсте
canvas.addEventListener('click', event => {
    // проверяем, что включен режим "Комментирование" и стоит галочка "Показывать комментарии"
    if (comments.dataset.state !== 'selected' || !commentsOnInput.checked) return;

    deleteAllBlankCommentFormsExcept();
    minimizeAllCommentFormsExcept();

    const newComment = createBlankForm();
    newComment.querySelector('.comments__marker-checkbox').checked = true;
    commentsWrap.appendChild(newComment);

    // смещаем координаты формы так, чтобы стрелка маркера указывала ровно на точку, куда мы кликнули
    const marker = newComment.querySelector('.comments__marker');

    const coordX = event.offsetX - getComputedStyle(marker).left.slice(0, -2) - (+getComputedStyle(marker).width.slice(0, -2)) / 2;
    const coordY = event.offsetY - getComputedStyle(marker).top.slice(0, -2) - getComputedStyle(marker).height.slice(0, -2);

    newComment.style.left = coordX + 'px';
    newComment.style.top = coordY + 'px';

    // и в каждую форму добавляем атрибуты data-left и data-top (координаты левого верхнего угла формы относительно currentImage)
    newComment.dataset.left = coordX;
    newComment.dataset.top = coordY;
});


// отрисовка комментариев, пришедших с сервера
function updateComments(newComments) {
    if (!newComments) return;
    Object.keys(newComments).forEach(id => {

        // если сообщение с таким id уже есть в shownComments (отрисованные комментарии), ничего не делаем
        if (id in shownComments) return;
        
        shownComments[id] = newComments[id];
        let needCreateNewForm = true;
        Array.from(document.querySelectorAll('.comments__form')).forEach(form => {
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

            newForm.style.left = newComments[id].left + 'px';
            newForm.style.top = newComments[id].top + 'px';
            
            addMsgToForm(newComments[id], newForm);
            commentsWrap.appendChild(newForm);

            if (!commentsOnInput.checked) {
                newForm.style.display = 'none';
            }
        }
    });
}

// добавляем новое сообщение в форму, так чтобы все сообщения внутри формы шли по порядку возрастания data-timestamp
const POSITIVE_INFINITY = 9999999999999;

function addMsgToForm(newMsg, form) {
    let timestamp = POSITIVE_INFINITY;
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

// обработка комментария от вэбсокета (преобразуем к тому же формату, что приходит по AJAX)
function insertWSComment(wsComment) {
    const wsCommentEdited = {};
    wsCommentEdited[wsComment.id] = {};
    wsCommentEdited[wsComment.id].left = wsComment.left;
    wsCommentEdited[wsComment.id].message = wsComment.message;
    wsCommentEdited[wsComment.id].timestamp = wsComment.timestamp;
    wsCommentEdited[wsComment.id].top = wsComment.top;

    updateComments(wsCommentEdited);
}

// ~~~~~~~~~~ Рисование ~~~~~~~~~~~~~~~

// убираю ластик
document.querySelector('.menu__eraser-wrap').style.display = 'none';

// изменение текущего цвета линий
Array.from(document.querySelectorAll('.menu__color')).forEach(colorInput => {
    colorInput.addEventListener('change', () => {
        if (!colorInput.checked) return;
        currColor = colorInput.value;
    });
});

// задаем все атрибуты холста и вставляем его в DOM
function createCanvas() {
    const width = getComputedStyle(currentImage).width.slice(0, -2);
    const height = getComputedStyle(currentImage).height.slice(0, -2);
    canvas.width = width;
    canvas.height = height;

    canvas.classList.add('user-strokes');
    canvas.style.zIndex = 5;

    commentsWrap.appendChild(canvas);

    curves = [];
    drawing = false;
    needsRepaint = false;
    currColor = '#6cbe47';
}

const BRUSH_RADIUS = 4;
const ctx = canvas.getContext('2d');
let curves = [];
let drawing = false;
let needsRepaint = false;
let currColor = '#6cbe47';
let curvesNumberToRemoveNextTime = 0;

// --- кривые и фигуры ---

// рисуем точку
function circle(point) {
    ctx.beginPath();
    ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
    ctx.fill();
}

// рисуем плавную линию между двумя точками
function smoothCurveBetween(p1, p2) {
    // Bezier control point
    const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
    ctx.quadraticCurveTo(...p1, ...cp);
}

// рисуем плавную линию между множеством точек
function smoothCurve(points) {
    ctx.beginPath();
    ctx.lineWidth = BRUSH_RADIUS;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.moveTo(...points[0]);

    for (let i = 1; i < points.length - 1; i++) {
        smoothCurveBetween(points[i], points[i + 1]);
    }

    ctx.stroke();
}

// --- events ---

// задаем координаты точки в виде массива
function makePoint(x, y) {
    return [x, y];
}

canvas.addEventListener('mousedown', event => {
    if (draw.dataset.state !== 'selected') return;

    drawing = true;

    const curve = []; // создаем новую кривую
    curve.color = currColor; // определяем цвет кривой

    curve.push(makePoint(event.offsetX, event.offsetY)); // создаем новую точку
    curves.push(curve); // добавляем кривую curve к массиву кривых curves
    needsRepaint = true;
});

canvas.addEventListener('mouseup', () => {
    drawing = false;
});

canvas.addEventListener('mouseleave', () => {
    drawing = false;
});

canvas.addEventListener('mousemove', event => {
    if (draw.dataset.state !== 'selected') return;

    if (drawing) {
        // добавляем точку
        const point = makePoint(event.offsetX, event.offsetY);
        curves[curves.length - 1].push(point);
        needsRepaint = true;
    }
});


// rendering
function repaint() {
    // очищаем перед перерисовкой
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    curves
        .forEach(curve => {
            // задаем цвет
            ctx.strokeStyle = curve.color;
            ctx.fillStyle = curve.color;
            // first...
            circle(curve[0]);

            // the body is comprised of lines
            smoothCurve(curve);
        });
}

const throttleSendImageToServer = throttleImg(sendImageToServer, 2000);
const debounceSendImageToServer = debounceImg(sendImageToServer, 2000);

// проверяем и при необходимости перерисовываем холст в каждый AnimationFrame
function tick() {
    if (needsRepaint) {
        repaint();
        throttleSendImageToServer();
        debounceSendImageToServer();
        needsRepaint = false;
    }

    window.requestAnimationFrame(tick);
}

tick();

// ~~~~~~~~~~~~~~~~~ Рисование: взаимодействие с сервером ~~~~~~~~~~~~~~~~~~~

// создаем img элемент, через который будем отражать рисунки пользователей, пришедшие с сервера
function createUserStrokesImgElement() {
    if (!userStrokesImgElement) {
        userStrokesImgElement = document.createElement('img');
    }
    userStrokesImgElement.src = './pic/transparent.png';
    userStrokesImgElement.classList.add('user-strokes');
    commentsWrap.appendChild(userStrokesImgElement);
}

// используем, чтобы посылать данные на сервер не чаще 1 раза в несколько секунд
function throttleImg(callback, delay) {
    let isWaiting = false;
    return function (...rest) {
        if (!isWaiting) {
            console.log('вызываю throttle callback!');
            callback.apply(this, rest);
            isWaiting = true;
            setTimeout(() => {
                isWaiting = false;
            }, delay);
        }
    };
}

// используем чтобы дослать все оставшиеся данные через несколько секунд простоя
function debounceImg(callback, delay) {
    let timeout;
    return () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            console.log('вызываю debounce callback!');
            callback();
        }, delay);
    };
}

// посылаем рисунки пользователя на сервер
function sendImageToServer() {
    canvas.toBlob(blob => {
        if (!wsGlobal) return;
        const curvesNumberToRemoveNow = curvesNumberToRemoveNextTime;
        curves.splice(0, curvesNumberToRemoveNow);
        curvesNumberToRemoveNextTime = curves.length - 1;

        wsGlobal.send(blob);
    });
}

// отражаем рисунки пользователей, пришедшие с сервера, в userStrokesImgElement
function drawUsersStrokes(url) {
    if (!url) return;
    userStrokesImgElement.src = url;
    console.log(url);
}
