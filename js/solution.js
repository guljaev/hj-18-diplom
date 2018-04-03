'use strict';

const wrap = document.querySelector('.wrap');
const menu = wrap.querySelector('.menu');
const burger = menu.querySelector('.burger');
const comments = menu.querySelector('.comments');
const draw = menu.querySelector('.draw');
const share = menu.querySelector('.share');
const modeHTMLElements = Array.from( menu.querySelectorAll('.mode') );


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

//~~~~~~~~~~~~~~Убираем лишние элементы при загрузке DOM~~~~~~~~~~~~~~~

wrap.querySelector('.current-image').src = '';
wrap.querySelector('.comments__form').style.display = 'none';


// ~~~~~~~~~~~~~~Состояние "Публикация" (по умолчанию)~~~~~~~~~~~~~~~

wrap.dataset.state = '';
menu.dataset.state = 'initial';

// menu.querySelector('.burger').style.display = 'none';
// menu.querySelector('.mode.comments').style.display = 'none';
// menu.querySelector('.mode.draw').style.display = 'none';
// menu.querySelector('.mode.share').style.display = 'none';
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
    // console.log(file);
    publishImage(file);
});
menu.querySelector('.new').insertBefore(fileInput, menu.querySelector('.new').firstElementChild);

wrap.addEventListener('drop', event => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    // console.log(file);
    publishImage(file);
});
wrap.addEventListener('dragover', event => event.preventDefault());

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
        menu.style.display = '';
        wrap.querySelector('.image-loader').style.display = 'none';
        if (res.status >= 400) throw res.statusText;
        // console.log(res);
        return res.json();
    })

    .then(res => {
        // console.log(1);
        // console.log(res);
        return fetch(`https://neto-api.herokuapp.com/pic/${res.id}`)
    })
    .then(res => {
        if (res.status >= 400) throw res.statusText;
        // console.log(2);
        return res.json();
    })
    .then(res => {
        console.log(res);
        // переключаем режим
        menu.dataset.state = 'selected';
        modeHTMLElements.forEach(elem => elem.dataset.state = '');
        share.dataset.state = 'selected';
        menu.querySelector('input.menu__url').value = `https://neto-api.herokuapp.com/pic/${res.id}`;
        wrap.querySelector('.current-image').src = res.url;
    })
    .catch(err => {
        menu.style.display = 'none';
        wrap.querySelector('.image-loader').style.display = 'none';
        wrap.querySelector('.error__message').textContent = err;
        wrap.querySelector('.error').style.display = '';
        console.log(err);
    });
}

// переключение режимов

burger.addEventListener('click', () => {
    menu.dataset.state = 'default';
    modeHTMLElements.forEach(elem => elem.dataset.state = '');
});

modeHTMLElements.forEach(elem => {
    if (elem.classList.contains('new')) {

    } else {
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

