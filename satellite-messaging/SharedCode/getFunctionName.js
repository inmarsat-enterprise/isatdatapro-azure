module.exports = function(pathName) {
  const fNameParts = pathName.split('/');
  return fNameParts[fNameParts.length - 2];
};