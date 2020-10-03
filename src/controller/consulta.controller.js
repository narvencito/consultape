"use strict";
var request = require("request");
const cheerio = require("cheerio");
const async = require("async");
const jszip = require("jszip");
const https = require('https');

var opts = {
	jar: true,
	timeout: 10000,
	encoding: null,
	headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36'
	}
};

var options = {
	headers: {
		"Content-Type": "application/json;chartset=utf-8",
		"Requestverificationtoken": "Dmfiv1Unnsv8I9EoXEzbyQExSD8Q1UY7viyyf_347vRCfO-1xGFvDddaxDAlvm0cZ8XgAKTaWclVFnnsGgoy4aLlBGB5m-E8rGw_ymEcCig1:eq4At-H2zqgXPrPnoiDGFZH0Fdx5a-1UiyVaR4nQlCvYZzAhzmvWxLwkUk6-yORYrBBxEnoG5sm-Hkiyc91so6-nHHxIeLee5p700KE47Cw1"
	}
};
var ciudadano = request.defaults(options);
request = request.defaults(opts);
function ConsultaPe() { }

function getEssaludInformationOther(dni, callback) {

	var BASE_RENIEC = process.env.URL_RENIEC;
	var BASE_ESSALUD = process.env.URL_OTRO_DNI;
	ciudadano.post(BASE_RENIEC, { form: { "CODDNI": dni } },
		function (err, response, body) {
			let item = JSON.parse(body);
			if (!item.success) {
				return callback(item.mensaje);
			}
			let persona = {};
			if (err) {
				return callback(err);
			} else {
				if (item.success) {
					var d = item.data.split("|");
					persona.dni = dni;
					persona.nombres = d[2];
					persona.apellidoPaterno = d[0];
					persona.apellidoMaterno = d[1];
					persona.fechaNacimientoUTC = null;
					persona.fechaNacimiento = null;
					ciudadano.post(BASE_ESSALUD, { form: { "APE_PAT": persona.apellidoPaterno, "APE_MAT": persona.apellidoMaterno, "NOMBRES": persona.nombres } },
						function (err, response, body) {
							if (err) {
								return callback(err);
							}
							const $ = cheerio.load(body);
							$("table > tr").map((index, element) => {
								const dniBuscado = $($(element).find("td")[1]).text().replace("ver", "").trim();
								if (dniBuscado === dni) {
									persona.fechaNacimientoUTC = $($(element).find("td")[2]).text().replace("ver", "").replace("//", "").trim();
									persona.fechaNacimiento = parseISOString(persona.fechaNacimientoUTC);
									return persona;
								}
							});
							persona.sexo = "";
							persona.codVerifica = getCode(dni);
							return callback(null, persona);
						});
				} else {
					return callback(item.mensaje);
				}
			}
		});
}

function getEssaludInformation(dni, callback) {
	var BASE = process.env.URL_ESSALUD;
	https.get(BASE + '?strDni=' + dni, (response) => {
		let data = '';
		let persona = {};
		response.on('data', (chunk) => {
			data += chunk;
		});
		response.on('end', () => {
			var datos = JSON.parse(data);
			var d = datos.DatosPerson[0];
			persona.dni = d.DNI;
			persona.nombres = d.Nombres;
			persona.apellidoPaterno = d.ApellidoPaterno;
			persona.apellidoMaterno = d.ApellidoMaterno;
			persona.fechaNacimientoUTC = d.FechaNacimiento;
			persona.fechaNacimiento = parseISOString(d.FechaNacimiento);

			if (d.Sexo === '2')
				persona.sexo = "MASCULINO";
			else
				persona.sexo = "FEMENINO"
			persona.codVerifica = getCode(d.DNI);
			return callback(null, persona);
		});
	}).on("error", (err) => {
		return getEssaludInformationOther(dni, function (err, data) {
			if (err) {
				return cb(err);
			} else {
				return cb(null, data);
			}
		});
	});
}

function parseISOString(stringDate) {
	if (!stringDate) {
		return null;
	}
	var d = stringDate.split(/\D+/);
	if (d.length > 2) {
		return new Date(Date.parse(d[1] + "/" + d[0] + "/" + d[2])).toISOString();
	}
	else {
		return null;
	}
}

function getCode(dni) {
	if (dni != "" || dni != null || dni.length == 8) {
		const hash = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
		let suma = 5;
		for (var i = 2; i < 10; i++) {
			suma += (parseInt(dni.charAt(i - 2)) * hash[i]);
		}
		const entero = parseInt(suma / 11);
		let digito = 11 - (suma - entero * 11);
		if (digito == 10) {
			digito = 0;
		}
		else if (digito == 11) {
			digito = 1;
		}
		return digito;
	}
	return "";
}

function getSunatInformation(html, additional, callback) {
	try {
		var $ = cheerio.load(html);
		var table = $("table").first().children("tr");
		var contribuyente = {};
		var rzhtml = table.first().children().eq(1).html();
		if (!rzhtml) {
			return callback(null, contribuyente);
		}
		var initData = rzhtml.split("-").map(function (wat) {
			return wat.trim();
		});
		contribuyente.ruc = initData[0];
		contribuyente.razonSocial = initData[1];
		contribuyente.nombreComercial = table.eq(additional ? 3 : 2).children().eq(1).text().split("-").map(function (splited) { return splited.trim(); }).join("-");
		contribuyente.tipo = table.eq(1).children().eq(1).text().trim();
		contribuyente.estado = table.eq(additional ? 5 : 4).children().eq(1).text().trim();
		contribuyente.condicion = table.eq(additional ? 6 : 5).children().eq(1).text().split("-").map(function (splited) { return splited.trim(); }).join("-");
		let direccion = table.eq(additional ? 7 : 6).children().eq(1).text().split("-").map(function (splited) { return splited.trim(); }).join("-");
		var ubigeo = direccion.slice(direccion.lastIndexOf('  ')).trim().split('-');
		contribuyente.direccion = direccion.slice(0, direccion.lastIndexOf('  ')).trim();
		contribuyente.departamento = additional ? "" : ubigeo[0];
		contribuyente.provincia = additional ? "" : ubigeo[1];
		contribuyente.distrito = additional ? "" : ubigeo[2];
		contribuyente.fechaInscripcion = parseISOString(table.eq(additional ? 4 : 3).children().eq(1).text().trim());
		contribuyente.sistEmsion = table.eq(additional ? 8 : 7).children().eq(1).text().trim();
		contribuyente.sistContabilidad = table.eq(additional ? 9 : 8).children().eq(1).text().trim();
		contribuyente.actExterior = table.eq(additional ? 8 : 7).children().eq(3).text().trim();
		contribuyente.actEconomicas = table.eq(additional ? 10 : 9).children().eq(1).children().eq(0).children().map(function () { return $(this).text().trim(); }).get();
		contribuyente.cpPago = table.eq(additional ? 11 : 10).children().eq(1).children().eq(0).children().map(function () { return $(this).text().trim(); }).get();
		contribuyente.sistElectronica = table.eq(additional ? 12 : 11).children().eq(1).children().eq(0).children().map(function () { return $(this).text().trim(); }).get()
		contribuyente.fechaEmisorFe = parseISOString(table.eq(additional ? 13 : 12).children().eq(1).text().trim());
		contribuyente.cpeElectronico = table.eq(additional ? 14 : 13).children().eq(1).map(function () { return $(this).text().split(",").map(function (splited) { return splited.trim(); }); }).get();
		contribuyente.fechaPle = parseISOString(table.eq(additional ? 15 : 14).children().eq(1).text().trim());
		contribuyente.padrones = table.eq(additional ? 16 : 15).children().eq(1).children().eq(0).children().map(function () { return $(this).text().trim(); }).get();
		return callback(null, contribuyente, html);
	} catch (e) {
		return callback(e);
	}
}

function getReniecInformation(dni, callback) {
	var BASE = process.env.URL_RENIEC;
	ciudadano.post(BASE, { form: { "CODDNI": dni } },
		function (err, response, body) {
			let item = JSON.parse(body);
			if (!item.success) {
				return callback(item.mensaje);
			}
			let persona = {};
			if (err) {
				return callback(err);
			} else {
				if (item.success) {
					var d = item.data.split("|");
					persona.dni = dni;
					persona.nombres = d[2];
					persona.apellidoPaterno = d[0];
					persona.apellidoMaterno = d[1];
					persona.codVerifica = getCode(dni);
					return callback(null, persona);
				} else {
					return callback(item.mensaje);
				}
			}
		});
}

function getCaptcha(base, cb) {
	var URL = "/captcha";
	var CAPTCHA_URL = base + URL;
	request.post(CAPTCHA_URL, { form: { "accion": "random" } }, function (err, response, body) {
		if (err) {
			return cb(err);
		} else {
			return cb(null, body.toString());
		}
	});
}

function getHtmlPage(ruc, cb) {
	var BASE = process.env.URL_SUNAT;
	var RUC_URL = BASE + "/jcrS00Alias";
	getCaptcha(BASE, function (err, captcha) {
		request.post(RUC_URL, {
			form: {
				"nroRuc": ruc,
				"accion": "consPorRuc",
				"numRnd": captcha
			}
		}, function (err, response, body) {
			if (err) {
				return cb(err);
			} else {
				return cb(null, body.toString());
			}
		});
	});
}

function parseZip(link, callback) {
	request.get(link, function (err, res, body) {
		if (err) {
			return callback(err);
		}

		var zip = new jszip();
		zip.loadAsync(body)
			.then(function (data) {
				data = data.file(/^.*\.txt$/)[0];
				data.async("string").then(function success(content) {
					return callback(null, content);
				}, function error(e) {
					return callback(e);
				});
			}, function (err) {
				return callback(err);
			})
	});
}

function parseHtmlZip(html, callback) {
	try {
		var $ = cheerio.load(html);
		var link = $("td.bg>a").first().attr("href");
		return callback(null, link);
	} catch (e) {
		return callback(e);
	}
}

function parseCsv(csv, callback) {
	csv = csv.replace(/\r/g, "");
	var data = csv.split("\n").map(function (line) {
		return line.split("|");
	});
	var columns = [
		"ruc",
		"razonSocial",
		"tipo",
		"profesion",
		"nombreComercial",
		"condicion",
		"estado",
		"fechaInscripcion",
		"inicioActividades",
		"departamento",
		"provincia",
		"distrito",
		"direccion",
		"telefono",
		"fax",
		"actExterior",
		"principalCIIU",
		"secundario1CIIU",
		"secundario2CIIU",
		"nuevoRus",
		"buenContribuyente",
		"agenteRetencion",
		"agentePercepcionVtaint",
		"agentePercepcionComliq",
		""
	];
	var result = [];
	data = data.splice(1);
	data.forEach(function (line) {
		if (line) {
			var r = {};
			if (line.length > 0) {
				line.forEach(function (l, index) {
					if (l && l.length > 0) {
						r[columns[index]] = l.trim();
					}
				});
				if (Object.keys(r).length > 0) {
					result.push(r);
				}
			}
		}
	});
	return callback(null, result);
}

function getZipPage(rucs, cb) {
	var BASE = process.env.URL_SUNAT_CVS;
	var RUC_URL = BASE + "/jrmS00Alias";
	async.waterfall([
		async.constant(BASE),
		getCaptcha,
		function (captcha, next) {
			var req_url = RUC_URL + "?accion=consManual&textRuc=&numRnd=" + captcha + "&" + rucs.map(function (r) {
				return "selRuc=" + r;
			}).join("&");

			request.post(req_url, function (err, response, body) {
				if (err) {
					return next(err);
				} else {
					return next(null, body);
				}
			});
		},
		parseHtmlZip,
		parseZip
	], function (err, result) {
		if (err) {
			return cb(err)
		} else {
			return cb(null, result);
		}
	});

}

ConsultaPe.prototype.getSunatInformation = function (ruc, additional, cb) {
	if (Array.isArray(ruc)) {
		if (ruc.length < 1) {
			return cb(null, []);
		}
		getZipPage(ruc, function (err, data) {
			if (err) {
				return cb(err);
			} else {
				parseCsv(data, function (err, res) {
					if (err) {
						return cb(err);
					} else {
						return cb(null, res);
					}
				});
			}
		});
	} else {
		getHtmlPage(ruc, function (err, body) {
			if (err) {
				return cb(err);
			}
			getSunatInformation(body, additional, function (err, data) {
				if (err) {
					return cb(err);
				} else {
					return cb(null, data, body);
				}
			});
		});
	}
};

ConsultaPe.prototype.getSunatDniInformation = function (dni, cb) {
	let digito = getCode(dni);
	let ruc = "10".concat(dni, digito);
	getHtmlPage(ruc, function (err, body) {
		if (err) {
			return cb(err);
		}
		getSunatInformation(body, true, function (err, data) {
			if (err) {
				return cb(err);
			} else {
				return cb(null, data, body);
			}
		});
	});

};

ConsultaPe.prototype.getJneInformation = function (dni, cb) {
	getReniecInformation(dni, function (err, data) {
		if (err) {
			return cb(err);
		} else {
			return cb(null, data);
		}
	});
}

ConsultaPe.prototype.getEssaludInformation = function (dni, cb) {
	getEssaludInformation(dni, function (err, data) {
		if (err) {
			return cb(err);
		} else {
			return cb(null, data);
		}
	});
}

module.exports = new ConsultaPe();