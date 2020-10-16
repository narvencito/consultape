const request = require('request').defaults({jar: true});
const urlCode = 'http://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/captcha?accion=random';
const urlPost = 'http://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias';

function Consulta2() {};
function getHtml(ruc ,cb){
    request(urlCode, (err, response, code) => {
       const formData = {
         nroRuc:ruc, 
         accion:'consPorRuc', 
         numRnd: code
       };
       request.post({url:urlPost, form: formData}, (err, response, body)=>{ 
         if (!err && response.statusCode == 200) {
           return cb(body);
         }
         console.log('error fetch ruc');
       });
    });

}

Consulta2.prototype.getHtmlConsultRuc = function (ruc ,cb){
    getHtml(ruc,(body)=>{
            return cb(body);
    });
}

module.exports = new  Consulta2();