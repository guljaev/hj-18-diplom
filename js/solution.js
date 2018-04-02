'use strict';

const wrap = document.querySelector('.wrap');
const menu = wrap.querySelector('.menu');

// dragability

let movedPiece = null;
let shiftX = 0;
let shiftY = 0;
const minX = wrap.offsetLeft;
const minY = wrap.offsetTop;
let maxX;
let maxY;

document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
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

function drop(event) {
    if (movedPiece) {
        movedPiece = null;
    }
}

function throttle(callback) {
    let isWaiting = false;
    return function () {
        if (!isWaiting) {
            callback.apply(this, arguments);
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

menu.querySelector('.burger').style.display = 'none';
menu.querySelector('.mode.comments').style.display = 'none';
menu.querySelector('.mode.draw').style.display = 'none';
menu.querySelector('.mode.share').style.display = 'none';
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
    console.log(file);
});
menu.querySelector('.new').insertBefore(fileInput, menu.querySelector('.new').firstElementChild);

wrap.addEventListener('drop', event => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    console.log(file);
});
wrap.addEventListener('dragover', event => event.preventDefault());





