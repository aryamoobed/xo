let tempHelpConfig = [];
let frame = [];
let snap = [];
let currentAlias = "x";
let curentDisplayedHelp = -1;
let globalIntervals = [];

$(document).on("click", "#help-container .child-cell", function () {
  const cellIndex = $(this).index(); //NOTE: as its not the first element in parent element it starts from 1
  const parentCellIndex = $(this).parent().index() + 1; //NOTE: to treat the index same as above +1 is added
  const mainCell = $("#help-container .main-cell");
  // console.log(parentCellIndex, cellIndex);

  if ($(this).hasClass("disabled")) return;
  // $(`#help-container .main-cell:not(:nth-child(${cellIndex+1})) .child-cell`).addClass("disabled")
  // $(`#help-container .main-cell:nth-child(${cellIndex+1}) .child-cell`).removeClass("disabled")
  // $(this)[0].classList.add("alias-x");
  // $(this)[0].innerHTML="X"

  playFrame("help-container", currentAlias, parentCellIndex, cellIndex);
  frame.push({
    parentCellIndex: parentCellIndex,
    cellIndex: cellIndex,
    currentAlias: currentAlias,
  });
  // console.log(frame);
  currentAlias == "o" ? (currentAlias = "x") : (currentAlias = "o");
});
$(document).on("click", "#save-btn", function () {
  saveFrame();
});
$(document).on("click", "#help-next-btn", function () {
  if (curentDisplayedHelp == helpConfig.length - 1) return;
  curentDisplayedHelp++;
  showScene("help-container", helpConfig, curentDisplayedHelp);
});
$(document).on("click", "#help-prev-btn", function () {
  if (curentDisplayedHelp == 0) return;
  curentDisplayedHelp--;
  showScene("help-container", helpConfig, curentDisplayedHelp);
});
$(document).on("click", "#take-snap-btn", function () {
  saveSnapToFrame("help-container");
});
$(document).on("click", "#show-frame-btn", function () {
  showScene("help-container", tempHelpConfig.length - 1);
});
$(document).on("pointerdown", ".main-win", function () {
  $(this).addClass("trans")

});
$(document).on("pointerup", ".main-win", function () {
  $(this).removeClass("trans")
});


function checkWin(aliasPattern) {
  const winCombinations = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
    [1, 5, 9],
    [3, 5, 7],
  ];
  let isGridWin = false;
  winCombinations.forEach((combination) => {
    if (isGridWin) return;
    let matchedCombination = 0;
    combination.forEach((item) => {
      if (aliasPattern.indexOf(item) != -1) matchedCombination++;
      if (matchedCombination == 3) isGridWin = true;
    });
  });
  return isGridWin;
}

// const animateInterval=setInterval(() => {
//   //playRandom("help-container")
// }, 100);

function playRandom(tableId) {
  const possibleMove = $(
    `#${tableId} .child-cell:not('.disabled'):not('.hide'):empty`
  );
  if (possibleMove.length == 0) return;
  const randomMove = Math.floor(Math.random() * possibleMove.length);
  // console.log(randomMove);
  possibleMove[randomMove].click();
}
function playFrame(tableId, alias, parentCellIndex, cellIndex) {
  //if the cell has been played before return "invalid move"
  if (
    $(
      `#${tableId} .main-cell:nth-child(${parentCellIndex}) .child-cell:nth-child(${
        cellIndex + 1
      })`
    ).text() != ""
  )
    return console.log("invalid move!");

  $(".waviy").removeClass("waviy");

  const playedCell = $(
    `#${tableId} .main-cell:nth-child(${parentCellIndex}) .child-cell:nth-child(${
      cellIndex + 1
    })`
  )[0];
  playedCell.innerHTML = alias;
  playedCell.classList.add(`alias-${alias}`);
  playedCell.classList.add(`waviy`);
  let aliasPattern = [];

  $(
    `#${tableId} .main-cell:nth-child(${parentCellIndex}) .child-cell:contains('${alias}')`
  ).each(function (index) {
    aliasPattern.push($(this).index());
  });

  //check if a grid has a winner
  let isGridWin = checkWin(aliasPattern);
  if (isGridWin) {
    $(".waviy").removeClass("waviy");

    const parentCell = $(
      `#${tableId} .main-cell:nth-child(${parentCellIndex})`
    );
    parentCell.children("span").text(alias);
    parentCell.children("span").removeClass("hide");
    parentCell.children("span").addClass(`alias-${alias}`);
    parentCell.children("span").addClass("main-win");
    parentCell.children("span").on("animationend", (event) => {
      parentCell.children(".child-cell").addClass("disabled");
    });

  //console.log("win", parentCellIndex, alias);
  }
  //check if the coresponding parentcell has a winner
  if (
    $(`#${tableId} .main-cell:nth-child(${cellIndex}) span`).hasClass(
      "main-win"
    )
  ) {
    // $(`#${tableId}  .child-cell`).removeClass("disabled"); //make all cells available to play
    $(`#${tableId}  .main-cell span:not(.main-win) `).siblings(".child-cell").removeClass("disabled"); //make all cells except main winner ones available to play
  } else {
    $(
      `#${tableId} .main-cell:not(:nth-child(${cellIndex})) .child-cell`
    ).addClass("disabled");
    $(`#${tableId} .main-cell:nth-child(${cellIndex}) .child-cell`).removeClass(
      "disabled"
    ); //make only corresponding cells available to play
  }
  //check if game has a winner
  if (!isGridWin) return; //if grid has no winner check is unneccesary
  if ($(`#${tableId} .main-win:contains("${alias}")`).length < 3) return; //if less than 3 winner parent check in unneccesary
  aliasPattern = [];
  $(`#${tableId} .main-win:contains("${alias}")`).each(function (index) {
    aliasPattern.push($(this).parent().index() + 1); //check for parent grid patter for a game winner
  });
  //if (checkWin(aliasPattern)) console.log(`${alias} wins the game`);
}
function saveFrame() {
  const description = $("#description-input").val();
  tempHelpConfig.push({ snap: snap, frame: frame, description: description });
  frame = [];
  snap = [];
//console.log(tempHelpConfig);
}
function saveSnapToFrame(tableId) {
  frame = [];
  snap = [];
  $(`#${tableId} .main-cell`)
    .children()
    .each(function (index) {
      snap.push({ class: $(this).attr("class"), text: $(this).text() });
    });
}
function showScene(tableId, helpConfig, index) {
  //clear the previous show frames
  if (globalIntervals.length > 0) {
    clearInterval(globalIntervals[0]);
    globalIntervals.splice(0, 1);
  }
  //show help descriotion
  $(`#${tableId} #description-span`).text(helpConfig[index].description);
  //initialize the game for help demo
  showSnap(tableId, helpConfig, index);
  //demo the actions
  let frameIndex = 0;
  if (helpConfig[index].frame.length > 0)
    globalIntervals.push(
      setInterval(
        () => {
          if (frameIndex == helpConfig[index].frame.length) {
            showSnap(tableId, helpConfig, index);
            return (frameIndex = 0);
          }
          playFrame(
            "help-container",
            helpConfig[index].frame[frameIndex].currentAlias,
            helpConfig[index].frame[frameIndex].parentCellIndex,
            helpConfig[index].frame[frameIndex].cellIndex
          );
          frameIndex++;
          // if (helpConfig[index].frame[frameIndex] === undefined) frameIndex = 0;
        },

        2000
      )
    );
}
function showSnap(tableId, helpConfig, index) {
  $(`#${tableId} .main-cell`)
    .children()
    .each(function (itemIndex) {
      $(this).text(helpConfig[index].snap[itemIndex].text);
      $(this).removeClass();
      $(this).addClass(helpConfig[index].snap[itemIndex].class);
    });
}
