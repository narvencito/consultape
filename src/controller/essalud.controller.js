const fetch = require('node-fetch');
const cheerio = require('cheerio');


const getDatos = async (ref = [], datos = []) => {

    let payload = {};

    try {
        await datos.filter((obj, index) => {
            let child = ref[index].childNodes[0]
            // validar si hay hijos
            if (child.children) {
                payload[obj] = child.children[0].data;
            } else {
                payload[obj] = child.data;
            }
            // response
            return obj;
        });
    } catch (error) {
        payload = {};
    }

    // response datos 
    return payload;
}


// petición al essalud
const search = async (dni) => {

    // cookie
    let cookie = "JSESSIONID=48cf176646b0318e076ed398446c2514a79c01e36f690a5b52b7f91857b02b55.e34SahmNbhaLay0LbxyPe0";
    // query
    let query = `pg=1&ll=Libreta%20Electoral%2FDNI&td=1&nd=${dni}&submit=Consultar&captchafield_doc=75821`;

    // api
    let html = await fetch(`http://ww4.essalud.gob.pe:7777/acredita/servlet/Ctrlwacre?${query}`, {
        method: 'POST',
        headers: {
            cookie
        }
    }).then(resData => resData.text())
        .then(res => res)
        .catch(err => null);
    // console.log(html);
    // selector html
    const selector = cheerio.load(html);

    // obtener tabla
    const resTable = selector("body").find("form > table > tbody > tr");

    const resTr = resTable.find('.tdDetRigth');

    const datos = await getDatos(resTr, [
        "nombre_completo",
        "numero_de_documento",
        "tipo_de_asegurado",
        "autogenerado",
        "_",
        "tipo_de_seguro",
        "centro_asistencial",
        "desde",
        "direccion",
        "hasta",
        "afiliado"
    ]);


    if (!Object.keys(datos).length) {
        return {
            success: false,
            message: `No se encontraron registros con el N° Documento: ${dni}`,
            data: {}
        }
    }

    return {
        success: true,
        message: "Datos encontrados!",
        data: datos
    };
}


module.exports = {
    searchDni: search
};